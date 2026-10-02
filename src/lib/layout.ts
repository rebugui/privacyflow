import type { DiagramTab, PrivacyStage } from '../types';
import { NODE_HEIGHT, NODE_WIDTH, stageDefs } from './nodeTypes';

const stages = Object.keys(stageDefs) as PrivacyStage[];
export function layoutDiagram(tab: DiagramTab): DiagramTab {
  const rows = new Map<PrivacyStage, number>();
  return {
    ...tab,
    nodes: tab.nodes.map((node) => {
      const row = rows.get(node.stage) ?? 0;
      rows.set(node.stage, row + 1);
      return { ...node, x: 80 + stages.indexOf(node.stage) * 300, y: 220 + row * 180 };
    }),
  };
}
export function nextNodePosition(tab: DiagramTab, stage: PrivacyStage): { x: number; y: number } {
  const column = stages.indexOf(stage);
  if (column < 0) throw new Error('처리 단계를 선택하세요');
  const x = 80 + column * 300;
  let y = 220;
  while (tab.nodes.some((node) => x < node.x + NODE_WIDTH + 40 && x + NODE_WIDTH + 40 > node.x && y < node.y + NODE_HEIGHT + 40 && y + NODE_HEIGHT + 40 > node.y)) y += 180;
  return { x, y };
}
