import type { StateStorage } from 'zustand/middleware';
import { useUiStore } from '../store/useUiStore';
import { parseProject } from './projectValidation';

export const STORAGE_KEY = 'privacyflow-project-v1';
export const projectStorage: StateStorage = {
  getItem(name) {
    let raw: string | null;
    try {
      raw = globalThis.localStorage.getItem(name);
    } catch {
      useUiStore.getState().setStorageState({ storageStatus: 'unavailable', rawBackup: null, saveError: true });
      return null;
    }
    if (raw === null) {
      useUiStore.getState().setStorageState({ storageStatus: 'empty', rawBackup: null, saveError: false });
      return null;
    }
    try {
      const envelope: unknown = JSON.parse(raw);
      if (!envelope || typeof envelope !== 'object' || Array.isArray(envelope) || !('version' in envelope) || envelope.version !== 0 || !('state' in envelope)) throw new Error('Unsupported storage envelope');
      const state = parseProject(envelope.state);
      useUiStore.getState().setStorageState({ storageStatus: 'ready', rawBackup: null, saveError: false });
      return JSON.stringify({ state, version: 0 });
    } catch {
      useUiStore.getState().setStorageState({ storageStatus: 'blocked', rawBackup: raw, saveError: false });
      return null;
    }
  },
  setItem(name, value) {
    if (useUiStore.getState().storageStatus === 'blocked') return;
    try {
      globalThis.localStorage.setItem(name, value);
      useUiStore.getState().setStorageState({ storageStatus: 'ready', rawBackup: null, saveError: false });
    } catch {
      useUiStore.getState().setStorageState({ saveError: true });
    }
  },
  removeItem(name) {
    if (useUiStore.getState().storageStatus === 'blocked') return;
    try {
      globalThis.localStorage.removeItem(name);
      useUiStore.getState().setStorageState({ storageStatus: 'empty', rawBackup: null, saveError: false });
    } catch {
      useUiStore.getState().setStorageState({ saveError: true });
    }
  },
};

/** Only call after the user confirms discarding the damaged stored project. */
export function unlockStorage(): void {
  useUiStore.getState().setStorageState({ storageStatus: 'empty', rawBackup: null, saveError: false });
}
