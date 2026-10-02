import type { Project } from "../types";
import { useProjectStore } from "./useProjectStore";
import { clearMissingSelection, useUiStore } from "./useUiStore";

const limit = 100;
const past: Project[] = [];
const future: Project[] = [];
let pending: Project | undefined;
let restoring = false;

function snapshot(state: Project): Project {
  // Store actions replace objects immutably; retain shared references, not deep copies.
  return {
    app: state.app,
    schema: state.schema,
    meta: state.meta,
    revisions: state.revisions,
    tabs: state.tabs,
    activeTabId: state.activeTabId,
  };
}
function flush() {
  if (!pending) return;
  past.push(pending);
  if (past.length > limit) past.shift();
  pending = undefined;
}
const unsubscribe = useProjectStore.subscribe((state, previous) => {
  if (
    restoring ||
    (state.tabs === previous.tabs &&
      state.meta === previous.meta &&
      state.revisions === previous.revisions)
  )
    return;
  // One gesture can synchronously delete several nodes and their incident flows.
  if (!pending) {
    pending = snapshot(previous);
    queueMicrotask(flush);
  }
  future.length = 0;
});

function restore(from: Project[], to: Project[]): boolean {
  flush();
  const target = from.pop();
  if (!target) return false;
  to.push(snapshot(useProjectStore.getState()));
  restoring = true;
  try {
    useProjectStore.setState(target);
    clearMissingSelection(target);
    useUiStore.getState().resetEditors();
  } finally {
    restoring = false;
  }
  return true;
}
export const undo = () => restore(past, future);
export const redo = () => restore(future, past);

if (import.meta.hot) import.meta.hot.dispose(unsubscribe);
