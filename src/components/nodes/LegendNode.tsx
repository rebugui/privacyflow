import type { Node, NodeProps } from "@xyflow/react";
type LegendItem = { label: string; shape: string; color: string };
export function LegendNode({ data }: NodeProps<Node<{ items: LegendItem[] }>>) {
  return <div className="legend"><strong>개인정보 처리 단계</strong><div className="legend-types">{data.items.map((item) => <div key={item.label}><i style={{ background: item.color }} />{item.label}</div>)}</div><div className="legend-links">실선 화살표: 출발 → 도착<br />점선: 끝점 위치 검토 필요</div><p className="muted">제공 ≠ 위탁 · 미지정은 안전함을 의미하지 않습니다.</p></div>;
}
