import { useState } from "react";
import { useProjectStore } from "../store/useProjectStore";
import { useUiStore } from "../store/useUiStore";
import { kindDefs, stageDefs } from "../lib/nodeTypes";
import { defaultNode } from "../lib/defaults";
import { NodeForm, FlowForm } from "./Forms";
import { nextNodePosition } from "../lib/layout";
import type { PrivacyNodeKind, PrivacyStage } from "../types";

export function LeftPanel() {
  const state = useProjectStore();
  const tab = state.tabs.find((t) => t.id === state.activeTabId)!;
  const ui = useUiStore();
  const [mode, setMode] = useState<"nodes" | "flows">("nodes");
  const [generation, reset] = useState(0);
  const [stage, setStage] = useState<PrivacyStage | "">("");
  return <aside className="left panel">
    <div className="panel-heading"><h2>개인정보 처리</h2><span className="count">{tab.nodes.length}개 활동</span></div>
    <div className="switcher"><button className={mode === "nodes" ? "active" : ""} onClick={() => setMode("nodes")}>처리 활동</button><button className={mode === "flows" ? "active" : ""} onClick={() => setMode("flows")}>전달 흐름</button></div>
    <div className="panel-content">
      {mode === "nodes" ? <>
        <label>팔레트 처리 단계<select value={stage} onChange={(e) => setStage(e.target.value as PrivacyStage | "")}><option value="">단계를 먼저 선택하세요</option>{Object.entries(stageDefs).map(([id, d]) => <option value={id} key={id}>{d.label}</option>)}</select></label>
        <p className="muted">단계 선택 후 클릭하여 추가하거나 캔버스로 드래그하세요.</p>
        <div className="palette">{Object.entries(kindDefs).map(([id, d]) => <button key={id} disabled={!stage} draggable={Boolean(stage)} style={{ borderLeftColor: stage ? stageDefs[stage].color : d.color }} onDragStart={(e) => {
          if (!stage) { e.preventDefault(); return; }
          e.dataTransfer.setData("application/privacyflow", JSON.stringify({ kind: id, stage }));
          e.dataTransfer.effectAllowed = "move";
        }} onClick={() => {
          if (!stage) return;
          let suffix = 1;
          while (tab.nodes.some((n) => n.name === `${d.label} ${suffix}`)) suffix++;
          const nodeId = state.addNode({ ...defaultNode(id as PrivacyNodeKind, stage), name: `${d.label} ${suffix}`, ...nextNodePosition(tab, stage) });
          ui.select(nodeId); ui.focus(nodeId);
        }}>{d.label}</button>)}</div>
        <div className="item-list">{tab.nodes.map((node) => <button key={node.id} className={ui.selected === node.id ? "selected" : ""} onClick={() => { ui.select(node.id); ui.focus(node.id); }}><strong>{node.name || "미지정"}</strong><small>{stageDefs[node.stage].label} · {kindDefs[node.kind].label}</small><small>담당자: {node.owner || "미지정"}</small></button>)}</div>
        <h3>새 처리 활동</h3>
        <NodeForm key={`node:${tab.id}:${generation}:${ui.editEpoch}`} onSave={(node) => {
          const live = useProjectStore.getState();
          const current = live.tabs.find((t) => t.id === live.activeTabId)!;
          ui.select(live.addNode({ ...node, ...nextNodePosition(current, node.stage) }));
          reset((g) => g + 1); ui.notify("처리 활동을 추가했습니다");
        }} />
      </> : <>
        <p className="muted">캔버스 연결점을 드래그하면 이름 없는 초안 흐름이 생성됩니다.</p>
        <div className="item-list">{tab.flows.map((item) => <button key={item.id} className={ui.selected === item.id ? "selected" : ""} onClick={() => { ui.select(item.id); ui.focus(item.id); }}><strong>{item.name || "미지정 흐름"}</strong><small>{tab.nodes.find((n) => n.id === item.from)?.name || "미지정"} → {tab.nodes.find((n) => n.id === item.to)?.name || "미지정"}</small></button>)}</div>
        <h3>새 전달 흐름</h3>
        <FlowForm key={`flow:${tab.id}:${generation}:${ui.editEpoch}`} nodes={tab.nodes} onSave={(item) => { ui.select(state.addFlow(item)); reset((g) => g + 1); ui.notify("전달 흐름을 추가했습니다"); }} />
      </>}
    </div>
  </aside>;
}
