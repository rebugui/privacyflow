import { expect, it } from 'vitest';
import type { DiagramTab, PrivacyStage } from '../types';
import { defaultNode } from './defaults';
import { layoutDiagram, nextNodePosition } from './layout';
import { makeProject } from './templates';

it('keeps provide and delegate in different columns and orders rows by node order', () => {
  const tab = makeProject(true).tabs[0];
  const before = structuredClone(tab);
  const placed = layoutDiagram(tab);
  expect(placed.nodes.map(({ stage, x, y }) => ({ stage, x, y }))).toEqual([
    { stage: 'collect', x: 80, y: 220 }, { stage: 'collect', x: 80, y: 400 },
    { stage: 'use', x: 380, y: 220 }, { stage: 'store', x: 680, y: 220 },
    { stage: 'destroy', x: 1580, y: 220 }, { stage: 'provide', x: 980, y: 220 },
    { stage: 'delegate', x: 1280, y: 220 },
  ]);
  expect(layoutDiagram(placed)).toEqual(placed);
  expect(tab).toEqual(before);
});

it.each(['collect', 'use', 'store', 'provide', 'delegate', 'destroy'] as const)('places %s at its first unobstructed row without moving manual positions', (stage: PrivacyStage) => {
  const empty: DiagramTab = { id: 'tab', name: '', nodes: [], flows: [] };
  const first = nextNodePosition(empty, stage);
  const tab: DiagramTab = { ...empty, nodes: [
    { ...defaultNode('activity', 'collect'), id: 'manual', x: first.x + 230, y: first.y + 10 },
    { ...defaultNode('activity', 'destroy'), id: 'manual2', x: first.x, y: first.y + 180 },
  ] };
  const before = structuredClone(tab);
  expect(nextNodePosition(tab, stage)).toEqual({ x: first.x, y: 580 });
  expect(tab).toEqual(before);
});

it('allows exactly 40px clearance and rejects missing explicit stage', () => {
  const tab: DiagramTab = { id: 'tab', name: '', nodes: [{ ...defaultNode('activity', 'collect'), id: 'node', x: 320, y: 220 }], flows: [] };
  expect(nextNodePosition(tab, 'collect')).toEqual({ x: 80, y: 220 });
  expect(() => nextNodePosition(tab, undefined as unknown as PrivacyStage)).toThrow('처리 단계를 선택하세요');
});
