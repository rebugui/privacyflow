import type { StateStorage } from 'zustand/middleware';
import { useUiStore } from '../store/useUiStore';
import { parseProject } from './projectValidation';

export const STORAGE_KEY = 'privacyflow-project-v1';
let baselineRaw: string | null = null;
let baselineKnown = false;
let stopped = false;
let pending = 0;
let queue: Promise<void> = Promise.resolve();
const ui = () => useUiStore.getState();
const locksAvailable = () => typeof navigator !== 'undefined' && typeof navigator.locks?.request === 'function';
const conflict = () => { stopped = true; ui().setStorageState({ saveStatus: 'conflict' }); };
const unavailable = () => {
  baselineKnown = false;
  ui().setStorageState({ storageStatus: 'unavailable', rawBackup: null, saveStatus: 'failed' });
};
function enqueue(name: string, value: string | null): void {
  if (stopped || ui().storageStatus === 'blocked' || ui().saveStatus === 'conflict') return;
  if (!locksAvailable()) { ui().setStorageState({ saveStatus: 'unsupported' }); return; }
  pending++;
  ui().setStorageState({ saveStatus: 'saving' });
  queue = queue.then(async () => {
    try {
      if (stopped || ui().storageStatus === 'blocked') return;
      ui().setStorageState({ saveStatus: 'saving' });
      await navigator.locks.request(`${STORAGE_KEY}:write`, { mode: 'exclusive' }, () => {
        // No suspension between comparison and mutation within the exclusive lock.
        let current: string | null;
        try { current = globalThis.localStorage.getItem(name); }
        catch { unavailable(); return; }
        if (baselineKnown ? current !== baselineRaw : current !== null) { conflict(); return; }
        if (value === null) globalThis.localStorage.removeItem(name);
        else globalThis.localStorage.setItem(name, value);
        baselineRaw = value;
        baselineKnown = true;
        ui().setStorageState({ storageStatus: value === null ? 'empty' : 'ready', rawBackup: null });
      });
    } catch {
      ui().setStorageState({ saveStatus: 'failed' });
    } finally {
      pending--;
      if (!pending && !stopped && ui().saveStatus === 'saving') ui().setStorageState({ saveStatus: 'saved' });
    }
  });
}
export const projectStorage: StateStorage = {
  getItem(name) {
    let raw: string | null;
    try { raw = globalThis.localStorage.getItem(name); }
    catch { unavailable(); return null; }
    baselineRaw = raw;
    baselineKnown = true;
    stopped = false;
    const saveStatus = locksAvailable() ? 'saved' : 'unsupported';
    if (raw === null) {
      ui().setStorageState({ storageStatus: 'empty', rawBackup: null, saveStatus });
      return null;
    }
    try {
      const envelope: unknown = JSON.parse(raw);
      if (!envelope || typeof envelope !== 'object' || Array.isArray(envelope) || !('version' in envelope) || envelope.version !== 0 || !('state' in envelope)) throw new Error('Unsupported storage envelope');
      const state = parseProject(envelope.state);
      ui().setStorageState({ storageStatus: 'ready', rawBackup: null, saveStatus });
      return JSON.stringify({ state, version: 0 });
    } catch {
      ui().setStorageState({ storageStatus: 'blocked', rawBackup: raw, saveStatus });
      return null;
    }
  },
  setItem: (name, value) => enqueue(name, value),
  removeItem: (name) => enqueue(name, null),
};
export function waitForPendingSaves(): Promise<void> { return queue; }
export function registerStorageEvents(): () => void {
  const check = () => {
    if (stopped || ui().storageStatus === 'blocked' || !baselineKnown) return;
    try { if (globalThis.localStorage.getItem(STORAGE_KEY) !== baselineRaw) conflict(); }
    catch { unavailable(); }
  };
  const onStorage = (event: StorageEvent) => {
    try {
      if (event.storageArea === globalThis.localStorage && (event.key === STORAGE_KEY || event.key === null)) check();
    } catch { unavailable(); }
  };
  globalThis.addEventListener('storage', onStorage);
  check();
  return () => globalThis.removeEventListener('storage', onStorage);
}
/** Only call after the user confirms discarding the damaged stored project. */
export function unlockStorage(): void {
  ui().setStorageState({ storageStatus: 'empty', rawBackup: null, saveStatus: locksAvailable() ? 'saved' : 'unsupported' });
}
