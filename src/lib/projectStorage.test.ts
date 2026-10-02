import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { makeProject } from './templates';

const key = 'privacyflow-project-v1';
beforeEach(() => vi.resetModules());
afterEach(() => vi.unstubAllGlobals());
function installStorage(raw: string | null = null) {
  const data = new Map<string, string>();
  if (raw !== null) data.set(key, raw);
  const storage = {
    getItem: vi.fn((name: string) => data.get(name) ?? null),
    setItem: vi.fn((name: string, value: string) => { data.set(name, value); }),
    removeItem: vi.fn((name: string) => { data.delete(name); }),
  };
  vi.stubGlobal('localStorage', storage);
  return { storage, data };
}
async function load() {
  // These imports intentionally exercise initial synchronous hydration against
  // freshly installed storage, which a static store import would bypass.
  const { useProjectStore: store, projectSnapshot } = await import('../store/useProjectStore');
  const { useUiStore: ui } = await import('../store/useUiStore');
  const boundary = await import('./projectStorage');
  return { store, ui, projectSnapshot, ...boundary };
}
it('hydrates canonical valid data without rewriting storage or creating initial undo', async () => {
  const project = makeProject(true);
  const raw = JSON.stringify({ state: { ...project, extra: 'discard' }, version: 0 });
  const { storage, data } = installStorage(raw);
  const { ui, projectSnapshot } = await load();
  expect(projectSnapshot()).toEqual(project);
  expect(ui.getState()).toMatchObject({ storageStatus: 'ready', rawBackup: null, saveError: false });
  expect(storage.setItem).not.toHaveBeenCalled();
  expect(data.get(key)).toBe(raw);
  // History must subscribe after the synchronous hydration boundary.
  const { undo } = await import('../store/projectHistory');
  expect(undo()).toBe(false);
});
it('leaves empty storage untouched until the user chooses or closes the template screen', async () => {
  const { storage, data } = installStorage();
  const { store, ui, projectSnapshot } = await load();
  expect(ui.getState().storageStatus).toBe('empty');
  expect(storage.setItem).not.toHaveBeenCalled();
  expect(projectSnapshot().tabs[0].nodes).toEqual([]);
  store.getState().resetProject(false);
  expect(storage.setItem).toHaveBeenCalledTimes(1);
  expect(JSON.parse(data.get(key)!).state).toEqual(projectSnapshot());
  expect(ui.getState().storageStatus).toBe('ready');
});
it.each([
  ['malformed JSON', '{broken'],
  ['unsupported envelope', JSON.stringify({ version: 9, state: makeProject(true) })],
  ['missing envelope version', JSON.stringify({ state: makeProject(true) })],
  ['foreign app', JSON.stringify({ version: 0, state: { ...makeProject(true), app: 'infoflow' } })],
  ['invalid project', JSON.stringify({ version: 0, state: { ...makeProject(true), tabs: [] } })],
])('blocks %s and preserves exact raw bytes until explicit recovery', async (_name, raw) => {
  const { storage, data } = installStorage(raw);
  const { store, ui, projectStorage, unlockStorage, projectSnapshot } = await load();
  expect(ui.getState()).toMatchObject({ storageStatus: 'blocked', rawBackup: raw });
  store.getState().setMeta({ author: 'memory only' });
  projectStorage.removeItem(key);
  expect(data.get(key)).toBe(raw);
  expect(storage.setItem).not.toHaveBeenCalled();
  expect(storage.removeItem).not.toHaveBeenCalled();
  expect(ui.getState().rawBackup).toBe(raw);
  unlockStorage();
  expect(storage.setItem).not.toHaveBeenCalled();
  store.getState().resetProject(false);
  expect(storage.setItem).toHaveBeenCalledTimes(1);
  expect(JSON.parse(data.get(key)!).state).toEqual(projectSnapshot());
  expect(ui.getState()).toMatchObject({ storageStatus: 'ready', rawBackup: null, saveError: false });
});
it('keeps editing and complete JSON backup available when storage access is denied', async () => {
  const { storage } = installStorage();
  storage.getItem.mockImplementation(() => { throw new DOMException('Denied', 'SecurityError'); });
  storage.setItem.mockImplementation(() => { throw new DOMException('Denied', 'SecurityError'); });
  const { store, ui, projectSnapshot } = await load();
  expect(ui.getState()).toMatchObject({ storageStatus: 'unavailable', saveError: true });
  store.getState().resetProject(true);
  store.getState().setMeta({ author: '저장 불가 환경 작성자' });
  const backup = JSON.parse(JSON.stringify(projectSnapshot()));
  expect(backup.meta.author).toBe('저장 불가 환경 작성자');
  expect(backup.tabs[0].nodes.map((node: { name: string }) => node.name)).toContain('회원관리');
  expect(ui.getState()).toMatchObject({ storageStatus: 'unavailable', saveError: true });
});
it('retains failed-save edits and clears the error on the next successful write', async () => {
  const { storage, data } = installStorage(JSON.stringify({ state: makeProject(true), version: 0 }));
  const { store, ui, projectSnapshot } = await load();
  const before = data.get(key);
  storage.setItem.mockImplementationOnce(() => { throw new DOMException('Full', 'QuotaExceededError'); });
  store.getState().setMeta({ author: '실패한 저장의 작성자' });
  expect(ui.getState().saveError).toBe(true);
  expect(data.get(key)).toBe(before);
  expect(projectSnapshot().meta.author).toBe('실패한 저장의 작성자');
  store.getState().setMeta({ reviewer: '복구 뒤 검토자' });
  expect(ui.getState()).toMatchObject({ saveError: false, storageStatus: 'ready' });
  expect(JSON.parse(data.get(key)!).state).toEqual(projectSnapshot());
});
