import { useMemo } from "react";
import { useProjectStore } from "../store/useProjectStore";
import { useUiStore } from "../store/useUiStore";
import { validate } from "../lib/validate";
import { flowPath } from "../lib/flowGeometry";
import type { Warning } from "../types";

export function Warnings() {
  const tab = useProjectStore((s) => s.tabs.find((t) => t.id === s.activeTabId)!);
  const warnings = useMemo<Warning[]>(() => [
    ...validate(tab),
    ...tab.flows.filter((f) => flowPath(tab, f).routeWarning).map((f): Warning => ({ level: "warn", flowId: f.id, message: "끝점 노드 위치를 분리하세요" })),
  ], [tab]);
  const ui = useUiStore();
  return <section className="warnings"><h2>검토 필요사항 <span className="count">{warnings.length}</span></h2>
    {warnings.length ? <div className="item-list">{warnings.map((w, i) => <button className={w.level} key={`${w.nodeId ?? w.flowId}:${i}`} onClick={() => { const id = w.nodeId ?? w.flowId; if (id) { ui.select(id); ui.focus(id); } }}>{w.level === "warn" ? "검토 필요" : "안내"} · {w.message}</button>)}</div>
      : <p className="preview">설정된 검토 규칙에서 누락을 찾지 못했습니다</p>}
    <p className="muted">검토 안내는 법적 적합성이나 인증을 보장하지 않으며 저장을 차단하지 않습니다.</p>
  </section>;
}
