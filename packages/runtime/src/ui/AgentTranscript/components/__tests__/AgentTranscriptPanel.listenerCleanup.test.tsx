/**
 * Regression test for NIM-2019 / issue #943.
 *
 * `AgentTranscriptPanel` subscribes to `session-files:updated`, and
 * `WorkstreamSessionTabs` mounts it with `key={activeSessionId}` -- so every
 * session switch is a full remount. The panel used to unsubscribe with
 * `electronAPI.off(channel, callback)`, which is a no-op across Electron's
 * contextBridge (the callback re-proxies on every crossing, so identity-based
 * removal never matches). One listener leaked per session switch; the reporter
 * hit 101 of them after 44 hours of uptime, shortly before the renderer
 * crashed.
 *
 * The fake `electronAPI` below models the bridge faithfully: `on()` returns a
 * working unsubscribe closure, and `off()` does nothing -- exactly what the
 * real preload did.
 */

import React from 'react';
import { render, cleanup } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AgentTranscriptPanel } from '../AgentTranscriptPanel';
import type { SessionData } from '../../../../ai/server/types';

vi.mock('virtua', async () => {
  const ReactModule = await import('react');
  return {
    VList: ReactModule.forwardRef(({ children }: { children: React.ReactNode }, ref) => {
      ReactModule.useImperativeHandle(ref, () => ({
        cache: undefined,
        scrollOffset: 0,
        scrollSize: 0,
        viewportSize: 0,
        findItemIndex: () => 0,
        scrollToIndex: vi.fn(),
      }));
      return <div data-testid="mock-vlist">{children}</div>;
    }),
  };
});

/** Listeners currently attached, per channel. */
const listeners = new Map<string, Set<(...args: any[]) => void>>();

function installFakeElectronAPI() {
  listeners.clear();
  (window as any).electronAPI = {
    invoke: vi.fn(async (channel: string) => {
      if (channel === 'session-files:get-by-session') return { success: true, files: [] };
      return { success: true };
    }),
    on: (channel: string, callback: (...args: any[]) => void) => {
      let set = listeners.get(channel);
      if (!set) {
        set = new Set();
        listeners.set(channel, set);
      }
      // The preload wraps the callback; the wrapper is what actually gets
      // registered, and only the returned closure can remove it.
      const handler = (...args: any[]) => callback(...args);
      set.add(handler);
      return () => set!.delete(handler);
    },
    // Modelled on the real bridge: identity-based removal cannot find the
    // wrapper, so this never removed anything.
    off: () => {},
  };
}

function makeSessionData(sessionId: string): SessionData {
  return {
    id: sessionId,
    provider: 'claude-code',
    messages: [],
    createdAt: new Date(1_784_648_445_000),
    updatedAt: new Date(1_784_648_445_000),
    workspacePath: '/tmp/workspace',
    metadata: {},
  } as unknown as SessionData;
}

describe('AgentTranscriptPanel session-files:updated subscription', () => {
  beforeEach(() => {
    installFakeElectronAPI();
    // jsdom has no CSS Custom Highlight API; TranscriptSearchBar uses it.
    (globalThis as any).CSS = { ...(globalThis as any).CSS, highlights: new Map() };
  });

  afterEach(() => {
    cleanup();
    delete (window as any).electronAPI;
  });

  it('leaves no session-files:updated listener behind after unmount', () => {
    const { unmount } = render(
      <AgentTranscriptPanel sessionId="session-a" sessionData={makeSessionData('session-a')} />
    );

    expect(listeners.get('session-files:updated')?.size ?? 0).toBe(1);

    unmount();

    expect(listeners.get('session-files:updated')?.size ?? 0).toBe(0);
  });

  it('does not accumulate listeners across repeated session switches', () => {
    // WorkstreamSessionTabs keys the panel by session id, so switching
    // sessions unmounts and remounts it.
    for (let i = 0; i < 50; i++) {
      const sessionId = `session-${i}`;
      const { unmount } = render(
        <AgentTranscriptPanel sessionId={sessionId} sessionData={makeSessionData(sessionId)} />
      );
      unmount();
    }

    expect(listeners.get('session-files:updated')?.size ?? 0).toBe(0);
  });
});
