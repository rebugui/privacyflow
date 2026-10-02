import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { DataFlow, DiagramTab, FlowNode, Project, ProjectMeta, Revision } from '../types';
import { makeProject } from '../lib/templates';
import { parseProject } from '../lib/projectValidation';
import { projectStorage, STORAGE_KEY } from '../lib/projectStorage';
import { clearMissingSelection, useUiStore } from './useUiStore';

export const uid = () => crypto.randomUUID();
export const today = () => new Date().toLocaleDateString('en-CA');
function uniqueTabName(tabs: DiagramTab[], base: string, suffix = 0): string {
  const names = new Set(tabs.map((tab) => tab.name));
  let name = suffix ? `${base} ${suffix}` : base;
  while (names.has(name)) {
    suffix = Math.max(2, suffix + 1);
    name = `${base} ${suffix}`;
  }
  return name;
}
interface Actions {
  addNode: (node: Omit<FlowNode, 'id'>) => string;
  updateNode: (id: string, patch: Partial<Omit<FlowNode, 'id' | 'x' | 'y'>>) => void;
  removeNode: (id: string) => void;
  addFlow: (flow: Omit<DataFlow, 'id'>) => string;
  updateFlow: (id: string, patch: Partial<Omit<DataFlow, 'id'>>) => void;
  removeFlow: (id: string) => void;
  updateTab: (tab: DiagramTab) => void;
  addTab: (template: boolean) => void;
  dupTab: (id: string) => void;
  removeTab: (id: string) => void;
  renameTab: (id: string, name: string) => void;
  setActiveTab: (id: string) => void;
  setMeta: (patch: Partial<ProjectMeta>) => void;
  addRevision: (revision: Omit<Revision, 'id'>) => void;
  removeRevision: (id: string) => void;
  replaceProject: (value: unknown) => void;
  resetProject: (template: boolean) => void;
}

export const useProjectStore = create<Project & Actions>()(
  persist((set, get) => {
    // Every public write is validated before set/persistence. Preserve unaffected
    // root references so navigation and selection never become undo operations.
    const commit = (patch: Partial<Project>) => {
      const checked = parseProject({ ...get(), ...patch });
      const canonical: Partial<Project> = {};
      if (patch.tabs !== undefined) canonical.tabs = checked.tabs;
      if (patch.meta !== undefined) canonical.meta = checked.meta;
      if (patch.revisions !== undefined) canonical.revisions = checked.revisions;
      if (patch.activeTabId !== undefined) canonical.activeTabId = checked.activeTabId;
      set(canonical);
      clearMissingSelection(get());
    };
    const edit = (fn: (tab: DiagramTab) => DiagramTab) => {
      const state = get();
      const active = state.tabs.find((tab) => tab.id === state.activeTabId)!;
      const next = fn(active);
      if (next !== active) commit({ tabs: state.tabs.map((tab) => tab.id === active.id ? next : tab) });
    };
    const resetEditors = () => useUiStore.getState().resetEditors();
    return {
      ...makeProject(false),
      addNode: (node) => {
        const id = uid();
        edit((tab) => ({ ...tab, nodes: [...tab.nodes, { ...node, id }] }));
        return id;
      },
      updateNode: (id, patch) => edit((tab) => tab.nodes.some((node) => node.id === id) ? {
        ...tab, nodes: tab.nodes.map((node) => node.id === id ? { ...node, ...patch, id, x: node.x, y: node.y } : node),
      } : tab),
      removeNode: (id) => edit((tab) => tab.nodes.some((node) => node.id === id) ? {
        ...tab, nodes: tab.nodes.filter((node) => node.id !== id), flows: tab.flows.filter((flow) => flow.from !== id && flow.to !== id),
      } : tab),
      addFlow: (flow) => {
        const id = uid();
        edit((tab) => ({ ...tab, flows: [...tab.flows, { ...flow, id }] }));
        return id;
      },
      updateFlow: (id, patch) => edit((tab) => tab.flows.some((flow) => flow.id === id) ? {
        ...tab, flows: tab.flows.map((flow) => flow.id === id ? {
          ...flow, ...patch, id,
          sourceHandle: patch.from !== undefined && patch.from !== flow.from ? null : patch.sourceHandle === undefined ? flow.sourceHandle : patch.sourceHandle,
          targetHandle: patch.to !== undefined && patch.to !== flow.to ? null : patch.targetHandle === undefined ? flow.targetHandle : patch.targetHandle,
        } : flow),
      } : tab),
      removeFlow: (id) => edit((tab) => tab.flows.some((flow) => flow.id === id) ? { ...tab, flows: tab.flows.filter((flow) => flow.id !== id) } : tab),
      updateTab: (tab) => {
        if (!get().tabs.some((current) => current.id === tab.id)) throw new Error('백업 데이터 구조가 올바르지 않습니다');
        commit({ tabs: get().tabs.map((current) => current.id === tab.id ? tab : current) });
      },
      addTab: (template) => {
        const tabs = get().tabs;
        const tab = makeProject(template).tabs[0];
        tab.name = uniqueTabName(tabs, '흐름도', tabs.length + 1);
        commit({ tabs: [...tabs, tab], activeTabId: tab.id });
        resetEditors();
      },
      dupTab: (id) => {
        const source = get().tabs.find((tab) => tab.id === id);
        if (!source) return;
        const ids = new Map(source.nodes.map((node) => [node.id, uid()]));
        const tab: DiagramTab = {
          id: uid(), name: uniqueTabName(get().tabs, `${source.name} 복사`),
          nodes: source.nodes.map((node) => ({ ...node, id: ids.get(node.id)! })),
          flows: source.flows.map((flow) => ({ ...flow, id: uid(), from: ids.get(flow.from)!, to: ids.get(flow.to)! })),
        };
        commit({ tabs: [...get().tabs, tab], activeTabId: tab.id });
        resetEditors();
      },
      removeTab: (id) => {
        const state = get();
        if (state.tabs.length === 1 || !state.tabs.some((tab) => tab.id === id)) return;
        const tabs = state.tabs.filter((tab) => tab.id !== id);
        commit({ tabs, activeTabId: state.activeTabId === id ? tabs[0].id : state.activeTabId });
        resetEditors();
      },
      renameTab: (id, name) => {
        if (get().tabs.some((tab) => tab.id === id)) commit({ tabs: get().tabs.map((tab) => tab.id === id ? { ...tab, name } : tab) });
      },
      setActiveTab: (id) => {
        if (id === get().activeTabId || !get().tabs.some((tab) => tab.id === id)) return;
        commit({ activeTabId: id });
        resetEditors();
      },
      setMeta: (patch) => commit({ meta: { ...get().meta, ...patch } }),
      addRevision: (revision) => commit({ revisions: [...get().revisions, { ...revision, id: uid() }] }),
      removeRevision: (id) => {
        if (get().revisions.some((revision) => revision.id === id)) commit({ revisions: get().revisions.filter((revision) => revision.id !== id) });
      },
      replaceProject: (value) => {
        const project = parseProject(value);
        set(project);
        clearMissingSelection(project);
        resetEditors();
      },
      resetProject: (template) => {
        const project = makeProject(template);
        set(project);
        clearMissingSelection(project);
        resetEditors();
      },
    };
  }, {
    name: STORAGE_KEY,
    storage: createJSONStorage(() => projectStorage),
    version: 0,
    partialize: (state) => ({ app: state.app, schema: state.schema, meta: state.meta, revisions: state.revisions, tabs: state.tabs, activeTabId: state.activeTabId }),
  }),
);

export function projectSnapshot(): Project {
  const state = useProjectStore.getState();
  return structuredClone({ app: state.app, schema: state.schema, meta: state.meta, revisions: state.revisions, tabs: state.tabs, activeTabId: state.activeTabId });
}
