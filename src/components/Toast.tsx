import { useEffect } from "react";
import { useUiStore } from "../store/useUiStore";
export function Toast() {
  const { toast, notify } = useUiStore();
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => notify(""), 3500);
    return () => clearTimeout(t);
  }, [toast, notify]);
  return toast ? (
    <div className="toast" role="status">
      {toast}
    </div>
  ) : null;
}
