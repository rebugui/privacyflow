import { beforeEach, afterEach, expect, it, vi } from 'vitest';

let drain: (() => Promise<void>) | undefined;
beforeEach(() => {
  vi.resetModules();
  const data = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => data.set(key, value),
    removeItem: (key: string) => data.delete(key),
  });
  vi.stubGlobal('navigator', { locks: { request: (_name: string, _options: unknown, callback: () => unknown) => Promise.resolve().then(callback) } });
});
afterEach(async () => { if (drain) await drain(); drain = undefined; vi.unstubAllGlobals(); });
async function setup() {
  // Static imports would hydrate before per-test storage and retain old subscriptions.
  const { useProjectStore: store, projectSnapshot } = await import('./useProjectStore');
  const { waitForPendingSaves } = await import('../lib/projectStorage');
  drain = waitForPendingSaves;
  store.getState().resetProject(true);
  const history = await import('./projectHistory');
  const { useUiStore: ui } = await import('./useUiStore');
  return { store, ui, projectSnapshot, waitForPendingSaves, ...history };
}
it('undoes multi-action deletion and incident flows atomically, persisting complete restored project', async () => {
  const { store, ui, projectSnapshot, undo, redo, waitForPendingSaves } = await setup();
  const before = projectSnapshot();
  const tab = before.tabs[0];
  ui.getState().select(tab.nodes[0].id);
  const epoch = ui.getState().editEpoch;
  store.getState().removeNode(tab.nodes[0].id);
  store.getState().removeNode(tab.nodes[1].id);
  expect(ui.getState().selected).toBeNull();
  expect(undo()).toBe(true);
  expect(projectSnapshot()).toEqual(before);
  expect(ui.getState().editEpoch).toBe(epoch + 1);
  await waitForPendingSaves();
  expect(JSON.parse(localStorage.getItem('privacyflow-project-v1')!).state).toEqual(before);
  expect(redo()).toBe(true);
  expect(store.getState().tabs[0].nodes.map((node) => node.id)).toEqual(tab.nodes.slice(2).map((node) => node.id));
  expect(store.getState().tabs[0].flows).toEqual(tab.flows.filter((flow) => !tab.nodes.slice(0, 2).some((node) => flow.from === node.id || flow.to === node.id)));
});
it('discards redo after new edits but ignores tab navigation', async () => {
  const { store, undo, redo } = await setup();
  store.getState().addTab(false);
  await Promise.resolve();
  store.getState().setMeta({ author: 'first' });
  await Promise.resolve();
  expect(undo()).toBe(true);
  store.getState().setActiveTab(store.getState().tabs[0].id);
  expect(redo()).toBe(true);
  expect(store.getState().meta.author).toBe('first');
  undo();
  store.getState().setMeta({ author: 'replacement' });
  expect(redo()).toBe(false);
  expect(store.getState().meta.author).toBe('replacement');
});
it('bounds history to the latest 100 operations', async () => {
  const { store, undo } = await setup();
  for (let index = 1; index <= 105; index++) {
    store.getState().setMeta({ version: String(index) });
    await Promise.resolve();
  }
  for (let index = 0; index < 100; index++) expect(undo()).toBe(true);
  expect(undo()).toBe(false);
  expect(store.getState().meta.version).toBe('5');
});
it('restores imported projects in one undo and rejects invalid imports without disturbing redo', async () => {
  const { store, projectSnapshot, undo, redo, ui } = await setup();
  const before = projectSnapshot();
  const imported = structuredClone(before);
  imported.meta.docTitle = '복원 문서';
  imported.tabs[0].nodes[0].retention = '단계 변경 뒤에도 남는 값';
  const epoch = ui.getState().editEpoch;
  store.getState().replaceProject(imported);
  expect(ui.getState().editEpoch).toBe(epoch + 1);
  expect(undo()).toBe(true);
  expect(projectSnapshot()).toEqual(before);
  expect(() => store.getState().replaceProject({ ...before, app: 'infoflow' })).toThrow('이 앱에서 만든 백업 파일이 아닙니다');
  expect(redo()).toBe(true);
  expect(projectSnapshot()).toEqual(imported);
});
it('groups multi-node movement and invalidates editors only on successful history transitions', async () => {
  const { store, ui, undo, redo } = await setup();
  const tab = store.getState().tabs[0];
  const epoch = ui.getState().editEpoch;
  const moved = { ...tab, nodes: tab.nodes.map((node, index) => index < 2 ? { ...node, x: node.x + 90, y: node.y + 40 } : node) };
  store.getState().updateTab(moved);
  expect(ui.getState().editEpoch).toBe(epoch);
  expect(undo()).toBe(true);
  expect(store.getState().tabs[0]).toEqual(tab);
  expect(ui.getState().editEpoch).toBe(epoch + 1);
  expect(redo()).toBe(true);
  expect(store.getState().tabs[0]).toEqual(moved);
  expect(redo()).toBe(false);
  expect(ui.getState().editEpoch).toBe(epoch + 2);
});
