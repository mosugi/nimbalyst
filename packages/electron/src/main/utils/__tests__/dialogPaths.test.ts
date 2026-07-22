import { describe, expect, it } from 'vitest';
import { selectDialogDefaultPath, selectedDialogDirectory } from '../dialogPaths';

describe('dialogPaths', () => {
  it('uses the active workspace for contextual dialogs', () => {
    expect(selectDialogDefaultPath({
      workspacePath: '/workspace/active',
      lastDirectory: '/previous',
      documentsPath: '/documents',
    })).toBe('/workspace/active');
  });

  it('uses the last directory for generic dialogs', () => {
    expect(selectDialogDefaultPath({
      workspacePath: null,
      lastDirectory: '/previous',
      documentsPath: '/documents',
    })).toBe('/previous');
  });

  it('falls back to Documents before Electron can default to Downloads', () => {
    expect(selectDialogDefaultPath({
      workspacePath: null,
      documentsPath: '/documents',
    })).toBe('/documents');
  });

  it('resolves relative suggested paths under the contextual directory', () => {
    expect(selectDialogDefaultPath({
      explicitPath: 'export.pdf',
      workspacePath: '/workspace/active',
      documentsPath: '/documents',
    })).toBe('/workspace/active/export.pdf');
  });

  it('preserves an explicit absolute path', () => {
    expect(selectDialogDefaultPath({
      explicitPath: '/chosen/export.pdf',
      workspacePath: '/workspace/active',
      documentsPath: '/documents',
    })).toBe('/chosen/export.pdf');
  });

  it('retains the filename while applying a suggested name', () => {
    expect(selectDialogDefaultPath({
      workspacePath: '/workspace/active',
      documentsPath: '/documents',
      suggestedName: 'untitled.md',
    })).toBe('/workspace/active/untitled.md');
  });

  it('remembers a file parent and a selected directory directly', () => {
    expect(selectedDialogDirectory('/chosen/file.md', 'file')).toBe('/chosen');
    expect(selectedDialogDirectory('/chosen/project', 'directory')).toBe('/chosen/project');
  });
});
