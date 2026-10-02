import { useEffect, useMemo, useState } from "react";
import { ReactFlow, Background, BackgroundVariant, Controls, MiniMap, ConnectionMode, useNodesState, useReactFlow } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useProjectStore } from "../store/useProjectStore";
import { useUiStore } from "../store/useUiStore";
import { kindDefs, stageDefs } from "../lib/nodeTypes";
import { defaultNode, defaultFlow } from "../lib/defaults";
import type { Port, PrivacyNodeKind, PrivacyStage } from "../types";
import { nodeTypes, edgeTypes, sceneNodes, sceneEdges } from "./scene";

export function Canvas() {
  const state = useProjectStore();
  const tab = state.tabs.find((t) => t.id === state.activeTabId)!;
  const ui = useUiStore();
  const flow = useReactFlow();
  const source = useMemo(() => sceneNodes(tab, state.meta), [tab, state.meta]);
  const [nodes, setNodes, onNodesChange] = useNodesState(source);
  const [selectedEdges, setSelectedEdges] = useState<Set<string>>(new Set());
  useEffect(() => {
    setNodes((current) => {
      const active = useUiStore.getState().selected;
      const selected = new Set(active ? [active, ...current.filter((n) => n.selected).map((n) => n.id)] : []);
      return source.map((n) => ({ ...n, selected: n.selectable !== false && selected.has(n.id) }));
    });
  }, [source, setNodes]);
  useEffect(() => {
    setNodes((current) => {
      if (ui.selected && current.some((n) => n.id === ui.selected && n.selected)) return current;
      return current.map((n) => ({ ...n, selected: n.selectable !== false && n.id === ui.selected }));
    });
  }, [ui.selected, setNodes]);
  useEffect(() => {
    if (!ui.focusId) return;
    const project = useProjectStore.getState();
    const current = project.tabs.find((item) => item.id === project.activeTabId)!;
    const focusedFlow = current.flows.find((item) => item.id === ui.focusId);
    const ids = focusedFlow ? [focusedFlow.from, focusedFlow.to] : [ui.focusId];
    const targets = flow.getNodes().filter((n) => ids.includes(n.id));
    if (targets.length) void flow.fitView({ nodes: targets, padding: 0.5, duration: 350, maxZoom: 1 });
  }, [ui.focusId, flow]);
  useEffect(() => {
    const timer = setTimeout(() => void flow.fitView({ padding: 0.18 }), 100);
    return () => clearTimeout(timer);
  }, [tab.id, flow]);
  const positions = new Map(nodes.map((n) => [n.id, n.position]));
  const renderTab = { ...tab, nodes: tab.nodes.map((n) => ({ ...n, ...(positions.get(n.id) ?? { x: n.x, y: n.y }) })) };
  const edges = sceneEdges(renderTab, ui.selected).map((edge) => ({ ...edge, selected: edge.selected || selectedEdges.has(edge.id) }));
  return <main className="canvas" aria-label="개인정보 처리 흐름도 캔버스"><ReactFlow
    nodes={nodes} edges={edges} nodeTypes={nodeTypes} edgeTypes={edgeTypes} onNodesChange={onNodesChange}
    onEdgesChange={(changes) => setSelectedEdges((current) => { const next = new Set(current); for (const change of changes) { if (change.type === "select") { if (change.selected) next.add(change.id); else next.delete(change.id); } else if (change.type === "remove") next.delete(change.id); } return next; })}
    connectionMode={ConnectionMode.Loose} minZoom={0.08} maxZoom={2} fitView deleteKeyCode={["Backspace", "Delete"]} multiSelectionKeyCode={["Meta", "Control", "Shift"]}
    onConnect={(connection) => {
      if (!connection.source || !connection.target) return;
      const allowed: (string | null | undefined)[] = ["top", "bottom", "left", "right", null, undefined];
      if (!allowed.includes(connection.sourceHandle) || !allowed.includes(connection.targetHandle)) return;
      const id = state.addFlow({ ...defaultFlow(connection.source, connection.target), sourceHandle: (connection.sourceHandle ?? null) as Port | null, targetHandle: (connection.targetHandle ?? null) as Port | null });
      ui.select(id);
    }}
    onNodeDragStop={(_, __, moved) => {
      const latest = useProjectStore.getState();
      const current = latest.tabs.find((t) => t.id === latest.activeTabId)!;
      const movedPositions = new Map(moved.map((n) => [n.id, n.position]));
      latest.updateTab({ ...current, nodes: current.nodes.map((n) => { const position = movedPositions.get(n.id); return position ? { ...n, ...position } : n; }) });
    }}
    onNodeClick={(_, n) => { if (n.selectable !== false) ui.select(n.id); }}
    onEdgeClick={(_, edge) => ui.select(edge.id)} onPaneClick={() => { ui.select(null); setSelectedEdges(new Set()); }}
    onDelete={({ nodes: deletedNodes, edges: deletedEdges }) => {
      const latest = useProjectStore.getState();
      const current = latest.tabs.find((t) => t.id === latest.activeTabId)!;
      const nodeIds = new Set(deletedNodes.map((n) => n.id));
      const edgeIds = new Set(deletedEdges.map((e) => e.id));
      latest.updateTab({ ...current, nodes: current.nodes.filter((n) => !nodeIds.has(n.id)), flows: current.flows.filter((f) => !edgeIds.has(f.id) && !nodeIds.has(f.from) && !nodeIds.has(f.to)) });
      ui.select(null); setSelectedEdges(new Set());
    }}
    onDragOver={(e) => { if (e.dataTransfer.types.includes("application/privacyflow")) { e.preventDefault(); e.dataTransfer.dropEffect = "move"; } }}
    onDrop={(e) => {
      e.preventDefault();
      let payload: unknown;
      try { payload = JSON.parse(e.dataTransfer.getData("application/privacyflow")); } catch { return; }
      if (!payload || typeof payload !== "object" || !("kind" in payload) || !("stage" in payload) || typeof payload.kind !== "string" || typeof payload.stage !== "string" || !Object.hasOwn(kindDefs, payload.kind) || !Object.hasOwn(stageDefs, payload.stage)) return;
      const kind = payload.kind as PrivacyNodeKind;
      const stage = payload.stage as PrivacyStage;
      const position = flow.screenToFlowPosition({ x: e.clientX, y: e.clientY });
      let suffix = 1;
      while (tab.nodes.some((n) => n.name === `${kindDefs[kind].label} ${suffix}`)) suffix++;
      ui.select(state.addNode({ ...defaultNode(kind, stage), name: `${kindDefs[kind].label} ${suffix}`, ...position }));
    }}
  ><Background variant={BackgroundVariant.Dots} gap={20} size={1} /><MiniMap position="top-right" style={{ width: 150, height: 100 }} pannable zoomable /><Controls /></ReactFlow>
    <div className="canvas-hint">연결점 드래그: 방향 흐름 추가 · Shift 선택: 여러 항목 · Delete: 삭제</div>
  </main>;
}
