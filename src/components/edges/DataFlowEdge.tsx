import { BaseEdge, type Edge, type EdgeProps } from "@xyflow/react";
import type { DataFlow } from "../../types";
import { flowLines } from "../../lib/nodeTypes";
import type { FlowRoute } from "../../lib/flowGeometry";
type FlowEdge = Edge<{ flow: DataFlow; geometry: FlowRoute }>;
export function DataFlowEdge({ id, data, selected, markerEnd }: EdgeProps<FlowEdge>) {
  if (!data) return null;
  const { geometry, flow } = data;
  const path = geometry.points.map((p, i) => `${i ? "L" : "M"} ${p.x} ${p.y}`).join(" ");
  const lines = flowLines(flow);
  return <>
    <BaseEdge id={id} path={path} markerEnd={markerEnd} style={{ stroke: selected ? "#2563EB" : "#404040", strokeWidth: selected ? 2.5 : 1.5, strokeDasharray: geometry.routeWarning ? "6 4" : undefined }} />
    <foreignObject x={geometry.label.x - 90} y={geometry.label.y - 28} width={180} height={56} pointerEvents="none">
      <div className={`edge-label${selected ? " selected" : ""}${geometry.routeWarning ? " route-warning" : ""}`} title={lines.join("\n")}>
        {geometry.routeWarning ? <><strong>{flow.name || "미지정"}</strong><span>끝점 노드 위치를 분리하세요</span></> : lines.map((line, i) => i === 0 ? <strong key={i}>{line}</strong> : <span key={i}>{line}</span>)}
      </div>
    </foreignObject>
  </>;
}
