import type { DataFlow, DiagramTab, FlowNode, Port, PrivacyNodeKind, PrivacyStage, Protection, TriState } from '../types';

export const NODE_WIDTH = 200;
export const NODE_HEIGHT = 112;
export type NodeShape = 'rect' | 'roundRect' | 'ellipse' | 'cylinder';
export const kindDefs: Record<PrivacyNodeKind, { label: string; shape: NodeShape; color: string }> = {
  subject: { label: '정보주체', shape: 'rect', color: '#E5E7EB' },
  activity: { label: '처리 활동', shape: 'roundRect', color: '#DBEAFE' },
  system: { label: '시스템', shape: 'rect', color: '#DCFCE7' },
  store: { label: '저장소', shape: 'cylinder', color: '#EDE9FE' },
  recipient: { label: '상대 기관', shape: 'rect', color: '#FEF3C7' },
};
export const stageDefs: Record<PrivacyStage, { label: string; color: string }> = {
  collect: { label: '수집', color: '#DBEAFE' },
  use: { label: '이용', color: '#DCFCE7' },
  store: { label: '보관', color: '#EDE9FE' },
  provide: { label: '제공', color: '#FEF3C7' },
  delegate: { label: '위탁', color: '#FFEDD5' },
  destroy: { label: '파기', color: '#E5E7EB' },
};
export const protectionLabels: Record<Protection, string> = {
  unknown: '미지정', none: '없음', tls: 'TLS', vpn: 'VPN', other: '기타',
};
export const triStateLabels: Record<TriState, string> = { unknown: '미지정', yes: '예', no: '아니오' };
export const portLabels: Record<Port, string> = { top: '위', right: '오른쪽', bottom: '아래', left: '왼쪽' };
export function nodeStyle(node: FlowNode) {
  return { ...kindDefs[node.kind], color: stageDefs[node.stage].color };
}
export function nodeLines(node: FlowNode): string[] {
  return [node.name || '미지정', stageDefs[node.stage].label, `담당자: ${node.owner || '미지정'}`, `항목: ${node.dataItems.slice(0, 3).join(', ') || '미지정'}`];
}
export function flowLines(flow: DataFlow): string[] {
  return [flow.name || '미지정', flow.dataItems.slice(0, 3).join(', ') || '미지정', flow.method || '미지정'];
}
export function legendItems(_tab: DiagramTab): { label: string; shape: NodeShape; color: string }[] {
  void _tab;
  return Object.values(stageDefs).map((stage) => ({ ...stage, shape: 'roundRect' }));
}
