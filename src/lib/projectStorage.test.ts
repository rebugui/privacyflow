import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { makeProject } from './templates';

const key = 'privacyflow-project-v1';
let drain: (() => Promise<void>) | undefined;
beforeEach(() => vi.resetModules());
afterEach(async () => {
  if (drain) await drain();
  drain = undefined;
  vi.unstubAllGlobals();
});
function installStorage(raw: string | null = null) {
  const data = new Map<string, string>();
  if (raw !== null) data.set(key, raw);
  const storage = {
    getItem: vi.fn((name: string) => data.get(name) ?? null),
    setItem: vi.fn((name: string, value: string) => { data.set(name, value); }),
    removeItem: vi.fn((name: string) => { data.delete(name); }),
  };
  vi.stubGlobal('localStorage', storage);
  vi.stubGlobal('navigator', { locks: { request: vi.fn((_name: string, _options: unknown, callback: () => unknown) => Promise.resolve().then(callback)) } });
  return { storage, data };
}
async function load() {
  const { useProjectStore: store, projectSnapshot } = await import('../store/useProjectStore');
  const { useUiStore: ui } = await import('../store/useUiStore');
  const boundary = await import('./projectStorage');
  drain = boundary.waitForPendingSaves;
  return { store, ui, projectSnapshot, ...boundary };
}
it('hydrates canonical valid data without rewriting storage or creating initial undo', async () => {
  const project = makeProject(true);
  const raw = JSON.stringify({ state: { ...project, extra: 'discard' }, version: 0 });
  const { storage, data } = installStorage(raw);
  const { ui, projectSnapshot } = await load();
  expect(projectSnapshot()).toEqual(project);
  expect(ui.getState()).toMatchObject({ storageStatus: 'ready', rawBackup: null, saveStatus: 'saved' });
  expect(storage.setItem).not.toHaveBeenCalled();
  expect(data.get(key)).toBe(raw);
  const { undo } = await import('../store/projectHistory');
  expect(undo()).toBe(false);
});
it('queues initial storage write until a user chooses a template', async () => {
  const { storage, data } = installStorage();
  const { store, ui, projectSnapshot, waitForPendingSaves } = await load();
  expect(ui.getState().storageStatus).toBe('empty');
  expect(storage.setItem).not.toHaveBeenCalled();
  store.getState().resetProject(false);
  expect(ui.getState().saveStatus).toBe('saving');
  await waitForPendingSaves();
  expect(JSON.parse(data.get(key)!).state).toEqual(projectSnapshot());
  expect(ui.getState()).toMatchObject({ storageStatus: 'ready', saveStatus: 'saved' });
});
it.each([
  ['malformed JSON', '{broken'],
  ['unsupported envelope', JSON.stringify({ version: 9, state: makeProject(true) })],
  ['missing envelope version', JSON.stringify({ state: makeProject(true) })],
  ['foreign app', JSON.stringify({ version: 0, state: { ...makeProject(true), app: 'infoflow' } })],
  ['invalid project', JSON.stringify({ version: 0, state: { ...makeProject(true), tabs: [] } })],
])('blocks %s and preserves exact raw bytes until explicit recovery', async (_name, raw) => {
  const { storage, data } = installStorage(raw);
  const { store, ui, projectStorage, unlockStorage, projectSnapshot, waitForPendingSaves } = await load();
  expect(ui.getState()).toMatchObject({ storageStatus: 'blocked', rawBackup: raw });
  store.getState().setMeta({ author: 'memory only' });
  projectStorage.removeItem(key);
  await waitForPendingSaves();
  expect(data.get(key)).toBe(raw);
  expect(storage.setItem).not.toHaveBeenCalled();
  expect(storage.removeItem).not.toHaveBeenCalled();
  unlockStorage();
  store.getState().resetProject(false);
  await waitForPendingSaves();
  expect(JSON.parse(data.get(key)!).state).toEqual(projectSnapshot());
  expect(ui.getState()).toMatchObject({ storageStatus: 'ready', rawBackup: null, saveStatus: 'saved' });
});
it('does not overwrite another tab during a confirmed damaged-project reset', async () => {
  const { data } = installStorage('{damaged');
  const { store, ui, unlockStorage, waitForPendingSaves } = await load();
  unlockStorage();
  data.set(key, 'newer tab bytes');
  store.getState().resetProject(false);
  await waitForPendingSaves();
  expect(data.get(key)).toBe('newer tab bytes');
  expect(ui.getState().saveStatus).toBe('conflict');
});
it('retains memory edits on denied reads; refuses unknown baseline when an old value reappears', async () => {
  const { storage, data } = installStorage();
  storage.getItem.mockImplementationOnce(() => { throw new DOMException('Denied', 'SecurityError'); });
  const { store, ui, projectSnapshot, waitForPendingSaves } = await load();
  expect(ui.getState()).toMatchObject({ storageStatus: 'unavailable', saveStatus: 'failed' });
  data.set(key, 'unseen value');
  store.getState().setMeta({ author: '메모리 편집' });
  await waitForPendingSaves();
  expect(projectSnapshot().meta.author).toBe('메모리 편집');
  expect(data.get(key)).toBe('unseen value');
  expect(ui.getState().saveStatus).toBe('conflict');
});
it('keeps failed-save edits and recovers on the next successful queued write', async () => {
  const { storage, data } = installStorage(JSON.stringify({ state: makeProject(true), version: 0 }));
  const { store, ui, projectSnapshot, waitForPendingSaves } = await load();
  const before = data.get(key);
  storage.setItem.mockImplementationOnce(() => { throw new DOMException('Full', 'QuotaExceededError'); });
  store.getState().setMeta({ author: '실패한 저장' });
  await waitForPendingSaves();
  expect(ui.getState().saveStatus).toBe('failed');
  expect(data.get(key)).toBe(before);
  store.getState().setMeta({ reviewer: '복구 뒤 검토자' });
  await waitForPendingSaves();
  expect(ui.getState()).toMatchObject({ saveStatus: 'saved', storageStatus: 'ready' });
  expect(JSON.parse(data.get(key)!).state).toEqual(projectSnapshot());
});
it('stops stale queued writes on an external deletion even without a storage event', async () => {
  const { data, storage } = installStorage(JSON.stringify({ state: makeProject(true), version: 0 }));
  const { store, ui, waitForPendingSaves } = await load();
  store.getState().setMeta({ author: 'stale tab' });
  data.delete(key);
  store.getState().setMeta({ reviewer: 'later stale edit' });
  await waitForPendingSaves();
  expect(ui.getState().saveStatus).toBe('conflict');
  expect(storage.setItem).not.toHaveBeenCalled();
  expect(data.has(key)).toBe(false);
});
it('reads a valid project without Web Locks but never pretends to save it', async () => {
  const { data, storage } = installStorage(JSON.stringify({ state: makeProject(true), version: 0 }));
  vi.stubGlobal('navigator', {});
  const { store, ui, projectSnapshot, waitForPendingSaves } = await load();
  expect(projectSnapshot().tabs[0].nodes.length).toBe(7);
  expect(ui.getState().saveStatus).toBe('unsupported');
  store.getState().setMeta({ author: 'memory only' });
  await waitForPendingSaves();
  expect(storage.setItem).not.toHaveBeenCalled();
  expect(JSON.parse(data.get(key)!).state.meta.author).not.toBe('memory only');
  expect(projectSnapshot().meta.author).toBe('memory only');
});
it('holds saving until the exclusive lock releases and writes edits in order', async () => {
  const { data } = installStorage();
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  vi.stubGlobal('navigator', { locks: { request: async (_name: string, _options: unknown, callback: () => unknown) => { await gate; return callback(); } } });
  const { store, ui, projectSnapshot, waitForPendingSaves } = await load();
  store.getState().setMeta({ author: 'first' });
  store.getState().setMeta({ author: 'latest' });
  expect(ui.getState().saveStatus).toBe('saving');
  expect(data.has(key)).toBe(false);
  release();
  await waitForPendingSaves();
  expect(ui.getState().saveStatus).toBe('saved');
  expect(JSON.parse(data.get(key)!).state).toEqual(projectSnapshot());
});
it('allows an unknown baseline to recover only when storage is genuinely empty', async () => {
  const { data, storage } = installStorage();
  storage.getItem.mockImplementationOnce(() => { throw new DOMException('Denied', 'SecurityError'); });
  const { store, ui, waitForPendingSaves } = await load();
  store.getState().setMeta({ author: 'recovered' });
  await waitForPendingSaves();
  expect(ui.getState()).toMatchObject({ saveStatus: 'saved', storageStatus: 'ready' });
  expect(JSON.parse(data.get(key)!).state.meta.author).toBe('recovered');
});
it('detects clear events and the hydration-to-listener gap without overwriting either change', async () => {
  const { data, storage } = installStorage(JSON.stringify({ state: makeProject(true), version: 0 }));
  let listener: ((event: StorageEvent) => void) | undefined;
  vi.stubGlobal('addEventListener', vi.fn((_type: string, callback: (event: StorageEvent) => void) => { listener = callback; }));
  vi.stubGlobal('removeEventListener', vi.fn());
  const { store, ui, registerStorageEvents, waitForPendingSaves } = await load();
  data.delete(key);
  const cleanup = registerStorageEvents();
  expect(ui.getState().saveStatus).toBe('conflict');
  expect(listener).toBeDefined();
  listener!({ storageArea: storage, key: null } as unknown as StorageEvent);
  store.getState().setMeta({ author: 'stale' });
  await waitForPendingSaves();
  expect(data.has(key)).toBe(false);
  expect(storage.setItem).not.toHaveBeenCalled();
  cleanup();
});
