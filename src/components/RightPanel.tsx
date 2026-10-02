import { useProjectStore } from "../store/useProjectStore";
import { useUiStore } from "../store/useUiStore";
import { stageDefs } from "../lib/nodeTypes";
import { validate } from "../lib/validate";
import { NodeForm, FlowForm } from "./Forms";
import { Warnings } from "./Warnings";

export function RightPanel() {
  const s = useProjectStore();
  const tab = s.tabs.find((t) => t.id === s.activeTabId)!;
  const ui = useUiStore();
  const node = tab.nodes.find((n) => n.id === ui.selected);
  const flow = tab.flows.find((f) => f.id === ui.selected);
  return <aside className="right panel">
    <section><h2>선택 속성</h2>
      {node ? <NodeForm key={`${node.id}:${ui.editEpoch}`} initial={node} submitLabel="변경 적용" onSave={(patch) => { s.updateNode(node.id, patch); ui.notify("변경 사항을 적용했습니다"); }} />
        : flow ? <FlowForm key={`${flow.id}:${ui.editEpoch}`} initial={flow} nodes={tab.nodes} submitLabel="변경 적용" onSave={(patch) => { s.updateFlow(flow.id, patch); ui.notify("변경 사항을 적용했습니다"); }} />
          : <div className="empty">캔버스에서 처리 활동 또는 전달 흐름을 선택하세요.</div>}
      {(node || flow) && <button className="danger" onClick={() => { if (node) s.removeNode(node.id); if (flow) s.removeFlow(flow.id); ui.select(null); }}>선택 항목 삭제</button>}
    </section>
    <Warnings />
    <section><h2>처리 단계 현황</h2><dl className="statistics">{Object.entries(stageDefs).map(([id, d]) => <div key={id}><dt>{d.label}</dt><dd>{tab.nodes.filter((n) => n.stage === id).length}개</dd></div>)}<div><dt>전달 흐름</dt><dd>{tab.flows.length}개</dd></div><div><dt>검토 필요</dt><dd>{validate(tab).length}건</dd></div></dl><p className="muted">단계는 시간 순서의 강제가 아닙니다. 제공과 위탁은 별도로 검토하세요.</p></section>
  </aside>;
}
