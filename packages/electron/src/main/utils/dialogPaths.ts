import { app, type BrowserWindow } from 'electron';
import { dirname, isAbsolute, join } from 'path';
import { store } from './store';
import { resolveActiveWorkspacePath, windows, windowStates } from '../window/windowState';

type SelectionKind = 'file' | 'directory';

export interface DialogPathOptions {
  window?: BrowserWindow | null;
  explicitPath?: string;
  suggestedName?: string;
}

interface DialogPathInputs {
  explicitPath?: string;
  workspacePath?: string | null;
  lastDirectory?: string;
  documentsPath: string;
  suggestedName?: string;
}

export function selectDialogDefaultPath(inputs: DialogPathInputs): string {
  const basePath = inputs.workspacePath || inputs.lastDirectory || inputs.documentsPath;
  if (inputs.explicitPath) {
    return isAbsolute(inputs.explicitPath)
      ? inputs.explicitPath
      : join(basePath, inputs.explicitPath);
  }
  return inputs.suggestedName ? join(basePath, inputs.suggestedName) : basePath;
}

export function selectedDialogDirectory(selectedPath: string, kind: SelectionKind): string {
  return kind === 'directory' ? selectedPath : dirname(selectedPath);
}

function workspacePathForWindow(window?: BrowserWindow | null): string | null {
  if (!window) return null;
  for (const [windowId, candidate] of windows) {
    if (candidate === window) {
      return resolveActiveWorkspacePath(windowStates.get(windowId));
    }
  }
  return null;
}

export function getDialogDefaultPath(options: DialogPathOptions = {}): string {
  return selectDialogDefaultPath({
    explicitPath: options.explicitPath,
    workspacePath: workspacePathForWindow(options.window),
    lastDirectory: store.get('lastDialogDirectory'),
    documentsPath: app.getPath('documents'),
    suggestedName: options.suggestedName,
  });
}

export function rememberDialogSelection(selectedPath: string | undefined, kind: SelectionKind): void {
  if (!selectedPath) return;
  store.set('lastDialogDirectory', selectedDialogDirectory(selectedPath, kind));
}
