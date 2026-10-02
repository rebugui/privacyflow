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
  // Import after the per-test storage boundary, since persist hydrates at module load.
  const { useProjectStore: store } = await import('./useProjectStore');
  const { waitForPendingSaves } = await import('../lib/projectStorage');
  drain = waitForPendingSaves;
  store.getState().resetProject(true);
  return store;
}
it('avoids existing generated names after deletion and manual renaming', async () => {
  const store = await setup();
  store.getState().addTab(false);
  const deletedId = store.getState().activeTabId;
  store.getState().addTab(false);
  store.getState().removeTab(deletedId);
  store.getState().addTab(false);
  let tabs = store.getState().tabs;
  expect(new Set(tabs.map((tab) => tab.name)).size).toBe(tabs.length);
  store.getState().renameTab(tabs[0].id, `흐름도 ${tabs.length + 2}`);
  store.getState().addTab(false);
  tabs = store.getState().tabs;
  expect(new Set(tabs.map((tab) => tab.name)).size).toBe(tabs.length);
  expect(new Set(tabs.map((tab) => tab.id)).size).toBe(tabs.length);
  store.getState().renameTab(tabs[0].id, tabs[1].name);
  expect(store.getState().tabs[0].name).toBe(tabs[1].name);
});
it('duplicates every node/flow ID independently and remaps self, reverse, and parallel endpoints', async () => {
  const store = await setup();
  const source = store.getState().tabs[0];
  const originalFlow = source.flows[0];
  store.getState().addFlow({ ...originalFlow, from: originalFlow.from, to: originalFlow.from });
  store.getState().addFlow({ ...originalFlow });
  store.getState().addFlow({ ...originalFlow, from: originalFlow.to, to: originalFlow.from });
  const expanded = store.getState().tabs[0];
  store.getState().dupTab(source.id);
  expect(store.getState().tabs[1].name).toBe(`${source.name} 복사`);
  store.getState().dupTab(source.id);
  store.getState().dupTab(source.id);
  const tabs = store.getState().tabs;
  expect(new Set(tabs.map((tab) => tab.name)).size).toBe(tabs.length);
  const ids = tabs.flatMap((tab) => [tab.id, ...tab.nodes.map((node) => node.id), ...tab.flows.map((flow) => flow.id)]);
  expect(new Set(ids).size).toBe(ids.length);
  for (const copy of tabs.slice(1)) {
    expect(copy.flows.map((flow) => [copy.nodes.findIndex((node) => node.id === flow.from), copy.nodes.findIndex((node) => node.id === flow.to)])).toEqual(expanded.flows.map((flow) => [expanded.nodes.findIndex((node) => node.id === flow.from), expanded.nodes.findIndex((node) => node.id === flow.to)]));
  }
  const copy = tabs[3];
  store.getState().updateNode(copy.nodes[0].id, { dataItems: ['복제본 항목'] });
  expect(store.getState().tabs[0].nodes[0].dataItems).toEqual(source.nodes[0].dataItems);
});
