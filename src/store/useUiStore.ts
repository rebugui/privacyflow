import { create } from 'zustand';
import type { Project } from '../types';

interface StorageState {
  storageStatus: 'empty' | 'ready' | 'blocked' | 'unavailable';
  rawBackup: string | null;
  saveStatus: 'saved' | 'saving' | 'failed' | 'conflict' | 'unsupported';
}
interface UiState extends StorageState {
  selected: string | null;
  focusId: string | null;
  toast: string;
  mobilePanel: 'canvas' | 'left' | 'right';
  setMobilePanel: (panel: 'canvas' | 'left' | 'right') => void;
  editEpoch: number;
  select: (id: string | null) => void;
  focus: (id: string) => void;
  notify: (text: string) => void;
  resetEditors: () => void;
  setStorageState: (patch: Partial<StorageState>) => void;
}
export const useUiStore = create<UiState>((set) => ({
  selected: null, focusId: null, toast: '', editEpoch: 0,
  storageStatus: 'empty', rawBackup: null, saveStatus: 'saved', mobilePanel: 'canvas',
  setMobilePanel: (mobilePanel) => set({ mobilePanel }),
  select: (selected) => set({ selected }),
  focus: (focusId) => set({ focusId, selected: focusId, mobilePanel: 'canvas' }),
  notify: (toast) => set({ toast }),
  resetEditors: () => set((state) => ({ editEpoch: state.editEpoch + 1 })),
  setStorageState: (patch) => set(patch),
}));

export function clearMissingSelection(project: Project): void {
  const tab = project.tabs.find((tab) => tab.id === project.activeTabId);
  const exists = (id: string | null) => id === null || !!tab?.nodes.some((node) => node.id === id) || !!tab?.flows.some((flow) => flow.id === id);
  const ui = useUiStore.getState();
  if (!exists(ui.selected) || !exists(ui.focusId)) useUiStore.setState({ selected: exists(ui.selected) ? ui.selected : null, focusId: exists(ui.focusId) ? ui.focusId : null });
}
