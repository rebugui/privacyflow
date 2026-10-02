import { MarkerType, type Node, type Edge } from "@xyflow/react";
import type { DiagramTab, ProjectMeta } from "../types";
import { validate } from "../lib/validate";
import { NODE_WIDTH, NODE_HEIGHT, legendItems } from "../lib/nodeTypes";
import { legendBox } from "../lib/geometry";
import { flowPath } from "../lib/flowGeometry";
import { FlowNode } from "./nodes/FlowNode";
import { TitleBlockNode } from "./nodes/TitleBlockNode";
import { LegendNode } from "./nodes/LegendNode";
import { DataFlowEdge } from "./edges/DataFlowEdge";
export const nodeTypes = { flowNode: FlowNode, title: TitleBlockNode, legend: LegendNode };
export const edgeTypes = { dataFlow: DataFlowEdge };
export function sceneNodes(tab: DiagramTab, meta: ProjectMeta): Node[] {
  const warnings = validate(tab);
  const legend = legendBox(tab);
  return [
    ...tab.nodes.map((node) => ({ id: node.id, type: "flowNode", position: { x: node.x, y: node.y }, width: NODE_WIDTH, height: NODE_HEIGHT, style: { width: NODE_WIDTH, height: NODE_HEIGHT }, data: { node, warning: warnings.some((w) => w.nodeId === node.id) } })),
    { id: "__title", type: "title", position: { x: 0, y: 0 }, width: 460, height: 110, style: { width: 460, height: 110 }, draggable: false, selectable: false, deletable: false, connectable: false, focusable: false, data: { meta, tabName: tab.name } },
    { id: "__legend", type: "legend", position: { x: legend.x, y: legend.y }, width: legend.width, height: legend.height, style: { width: legend.width, height: legend.height }, draggable: false, selectable: false, deletable: false, connectable: false, focusable: false, data: { items: legendItems(tab) } },
  ];
}
export function sceneEdges(tab: DiagramTab, selected?: string | null): Edge[] {
  return tab.flows.map((item) => ({
    id: item.id, source: item.from, target: item.to, sourceHandle: item.sourceHandle ?? "right", targetHandle: item.targetHandle ?? "left", type: "dataFlow",
    markerEnd: { type: MarkerType.ArrowClosed, color: selected === item.id ? "#2563EB" : "#404040", width: 16, height: 16 },
    data: { flow: item, geometry: flowPath(tab, item) }, selected: selected === item.id,
  }));
}
