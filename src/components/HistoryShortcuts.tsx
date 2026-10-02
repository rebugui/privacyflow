import { useEffect } from "react";
import { undo, redo } from "../store/projectHistory";
import { useUiStore } from "../store/useUiStore";

export function HistoryShortcuts() {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (
        !(event.metaKey || event.ctrlKey) ||
        event.altKey ||
        event.isComposing
      )
        return;
      const key = event.key.toLowerCase();
      if (key !== "z" && key !== "y") return;
      // Draft forms and dialogs own their native text undo history.
      if (
        document.querySelector("dialog[open]") ||
        event
          .composedPath()
          .some(
            (target) =>
              target instanceof HTMLElement &&
              (target.matches("input, textarea, select") ||
                target.isContentEditable),
          )
      )
        return;
      event.preventDefault();
      const isRedo = key === "y" || event.shiftKey;
      const changed = isRedo ? redo() : undo();
      const ui = useUiStore.getState();
      if (changed) ui.select(null);
      ui.notify(
        changed
          ? isRedo
            ? "다시 실행했습니다"
            : "실행을 취소했습니다"
          : isRedo
            ? "다시 실행할 작업이 없습니다"
            : "취소할 작업이 없습니다",
      );
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
  return null;
}
