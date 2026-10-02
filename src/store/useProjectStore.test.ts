import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { defaultFlow, defaultNode } from '../lib/defaults';
import { nextNodePosition } from '../lib/layout';

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
async function setup(template = true) {
  // The store must hydrate only after this test's storage has been installed.
  const module = await import('./useProjectStore');
  const { waitForPendingSaves } = await import('../lib/projectStorage');
  drain = waitForPendingSaves;
  const { useUiStore: ui } = await import('./useUiStore');
  module.useProjectStore.getState().resetProject(template);
  return { ...module, store: module.useProjectStore, ui, waitForPendingSaves };
}
it('preserves dragged coordinates when an older attribute form is applied and keeps ID references', async () => {
  const { store, ui } = await setup();
  const tab = store.getState().tabs[0];
  const selected = tab.nodes[0];
  const draft = { ...selected, name: '변경 이름' };
  ui.getState().select(selected.id);
  const epoch = ui.getState().editEpoch;
  store.getState().updateTab({ ...tab, nodes: tab.nodes.map((node) => node.id === selected.id ? { ...node, x: 987, y: -65 } : node) });
  store.getState().updateNode(selected.id, draft);
  expect(store.getState().tabs[0].nodes[0]).toMatchObject({ name: '변경 이름', x: 987, y: -65 });
  expect(store.getState().tabs[0].flows).toEqual(tab.flows);
  expect(ui.getState().selected).toBe(selected.id);
  expect(ui.getState().editEpoch).toBe(epoch);
});
it('resets only changed endpoint handles and rejects foreign endpoints atomically', async () => {
  const { store, projectSnapshot, waitForPendingSaves } = await setup();
  let tab = store.getState().tabs[0];
  const flow = tab.flows[0];
  store.getState().updateFlow(flow.id, { sourceHandle: 'top', targetHandle: 'bottom' });
  store.getState().updateFlow(flow.id, { from: tab.nodes[2].id, sourceHandle: 'left' });
  expect(store.getState().tabs[0].flows[0]).toMatchObject({ sourceHandle: null, targetHandle: 'bottom' });
  store.getState().updateFlow(flow.id, { sourceHandle: 'right', to: tab.nodes[3].id });
  expect(store.getState().tabs[0].flows[0]).toMatchObject({ sourceHandle: 'right', targetHandle: null });
  const before = projectSnapshot();
  await waitForPendingSaves();
  const persisted = localStorage.getItem('privacyflow-project-v1');
  expect(() => store.getState().updateFlow(flow.id, { from: 'absent' })).toThrow();
  expect(() => store.getState().addFlow(defaultFlow('absent', flow.to))).toThrow();
  tab = store.getState().tabs[0];
  expect(() => store.getState().updateTab({ ...tab, nodes: tab.nodes.map((node, index) => index ? node : { ...node, x: Infinity }) })).toThrow();
  expect(projectSnapshot()).toEqual(before);
  expect(localStorage.getItem('privacyflow-project-v1')).toBe(persisted);
});
it('keeps stages explicit, unknown tri-state intact, and hidden values across stage changes', async () => {
  const { store, projectSnapshot } = await setup(false);
  const id = store.getState().addNode({ ...defaultNode('activity', 'delegate'), entrustedTask: '보존 업무', recipient: '가상 상대기관' });
  store.getState().updateNode(id, { stage: 'use' });
  let node = projectSnapshot().tabs[0].nodes[0];
  expect(node).toMatchObject({ stage: 'use', entrustedTask: '보존 업무', recipient: '가상 상대기관', sensitive: 'unknown', uniqueIdentifier: 'unknown' });
  store.getState().updateNode(id, { stage: 'delegate' });
  node = projectSnapshot().tabs[0].nodes[0];
  expect(node.entrustedTask).toBe('보존 업무');
});
it('places new form nodes in the stage first free row without rearranging existing manual positions', async () => {
  const { store } = await setup(false);
  const empty = store.getState().tabs[0];
  const first = store.getState().addNode({ ...defaultNode('activity', 'provide'), ...nextNodePosition(empty, 'provide') });
  expect(store.getState().tabs[0].nodes[0]).toMatchObject({ x: 980, y: 220 });
  const current = store.getState().tabs[0];
  store.getState().updateTab({ ...current, nodes: current.nodes.map((node) => ({ ...node, x: 1100, y: 240 })) });
  const before = store.getState().tabs[0].nodes[0];
  store.getState().addNode({ ...defaultNode('recipient', 'provide'), ...nextNodePosition(store.getState().tabs[0], 'provide') });
  expect(store.getState().tabs[0].nodes.find((node) => node.id === first)).toEqual(before);
  expect(store.getState().tabs[0].nodes[1]).toMatchObject({ x: 980, y: 400 });
});
it('clears vanished selections and invalidates drafts on navigation, reset, and import', async () => {
  const { store, ui, projectSnapshot } = await setup();
  const tab = store.getState().tabs[0];
  ui.getState().focus(tab.nodes[0].id);
  let epoch = ui.getState().editEpoch;
  store.getState().addTab(false);
  expect(ui.getState()).toMatchObject({ selected: null, focusId: null, editEpoch: ++epoch });
  store.getState().setActiveTab(tab.id);
  expect(ui.getState().editEpoch).toBe(++epoch);
  ui.getState().select(tab.nodes[0].id);
  store.getState().replaceProject(projectSnapshot());
  expect(ui.getState()).toMatchObject({ selected: tab.nodes[0].id, editEpoch: ++epoch });
  store.getState().resetProject(false);
  expect(ui.getState()).toMatchObject({ selected: null, editEpoch: ++epoch });
});
it('rejects replacement before state, persistence, or editor epoch changes', async () => {
  const { store, ui, projectSnapshot, waitForPendingSaves } = await setup();
  const before = projectSnapshot();
  const epoch = ui.getState().editEpoch;
  await waitForPendingSaves();
  const persisted = localStorage.getItem('privacyflow-project-v1');
  const invalid = structuredClone(before);
  invalid.tabs[0].flows[0].to = '__legend';
  expect(() => store.getState().replaceProject(invalid)).toThrow('백업 데이터 구조가 올바르지 않습니다');
  expect(projectSnapshot()).toEqual(before);
  expect(localStorage.getItem('privacyflow-project-v1')).toBe(persisted);
  expect(ui.getState().editEpoch).toBe(epoch);
});
