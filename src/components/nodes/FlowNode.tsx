import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import type { FlowNode as FlowNodeModel, Port } from "../../types";
import { NODE_WIDTH, NODE_HEIGHT, nodeStyle, nodeLines } from "../../lib/nodeTypes";
const ports: [Port, Position][] = [["top", Position.Top], ["right", Position.Right], ["bottom", Position.Bottom], ["left", Position.Left]];
export function FlowNode({ data, selected }: NodeProps<Node<{ node: FlowNodeModel; warning: boolean }>>) {
  const style = nodeStyle(data.node);
  const lines = nodeLines(data.node);
  return <div className={`flow-node${selected ? " is-selected" : ""}`}>
    <svg className="flow-shape" width={NODE_WIDTH} height={NODE_HEIGHT} viewBox={`0 0 ${NODE_WIDTH} ${NODE_HEIGHT}`} aria-hidden="true">
      <g fill={style.color} stroke={selected ? "#2563EB" : "#404040"} strokeWidth={selected ? 3 : 1.5}>
        {style.shape === "cylinder" ? <><path d="M 2 17 C 2 -1 198 -1 198 17 L 198 94 C 198 116 2 116 2 94 Z" /><ellipse cx="100" cy="17" rx="98" ry="15" /></>
          : style.shape === "ellipse" ? <ellipse cx="100" cy="56" rx="98" ry="54" />
            : <rect x="2" y="2" width="196" height="108" rx={style.shape === "roundRect" ? 16 : 0} />}
      </g>
    </svg>
    <div className={`flow-node-label${style.shape === "cylinder" ? " cylinder-label" : ""}`} title={lines.join("\n")}>{lines.map((line, i) => i === 0 ? <strong key={i}>{line}</strong> : <span className={i === 1 ? "stage-badge" : undefined} key={i}>{line}</span>)}</div>
    {data.warning && <span className="node-warning" title="검토 필요사항이 있습니다" aria-label="검토 필요">!</span>}
    {ports.map(([id, position]) => <Handle key={`target-${id}`} id={id} type="target" position={position} className="back-handle" />)}
    {ports.map(([id, position]) => <Handle key={`source-${id}`} id={id} type="source" position={position} />)}
  </div>;
}
