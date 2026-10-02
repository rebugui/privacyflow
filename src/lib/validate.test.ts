import { expect, it } from 'vitest';
import type { DiagramTab, FlowNode } from '../types';
import { defaultFlow, defaultNode } from './defaults';
import { validate, reviewWarnings } from './validate';

const complete: FlowNode = { ...defaultNode('activity', 'use'), id: 'node', name: '활동', owner: '담당자', purpose: '목적', dataItems: ['이름'], legalBasis: '검토 근거' };
it.each([
  ['store', 'retention', '보유기간', { storageLocation: '위치' }],
  ['store', 'storageLocation', '보관위치', { retention: '기간' }],
  ['delegate', 'entrustedTask', '위탁업무', { recipient: '가상 상대기관' }],
  ['provide', 'recipient', '상대기관', {}],
  ['destroy', 'destructionMethod', '파기방법', {}],
] as const)('clears only the applicable %s/%s review when supplied', (stage, field, label, values) => {
  const node: FlowNode = { ...complete, ...values, stage };
  const tab: DiagramTab = { id: 'tab', name: '', nodes: [node], flows: [] };
  expect(validate(tab)).toEqual([{ level: 'warn', nodeId: 'node', message: `검토 필요: ${label} 미지정` }]);
  const updated: FlowNode = { ...node, [field]: '조직별 확인 값' };
  expect(validate({ ...tab, nodes: [updated] })).toEqual([]);
});

it('retains former stage values without using them to produce current-stage warnings', () => {
  const node = { ...complete, stage: 'use' as const, entrustedTask: '보존된 위탁업무', recipient: '', retention: '', storageLocation: '', destructionMethod: '' };
  expect(validate({ id: 'tab', name: '', nodes: [node], flows: [] })).toEqual([]);
  expect(node.entrustedTask).toBe('보존된 위탁업무');
});

it('reviews sensitive data safeguards only for explicitly confirmed inclusion', () => {
  const tab: DiagramTab = { id: 'tab', name: '', nodes: [{ ...complete, sensitive: 'yes' }], flows: [] };
  expect(validate(tab)).toEqual([{ level: 'warn', nodeId: 'node', message: '검토 필요: 민감정보/고유식별정보 보호조치 확인' }]);
  expect(validate({ ...tab, nodes: [{ ...tab.nodes[0], safeguards: '조직별 보호조치' }] })).toEqual([]);
  expect(complete.sensitive).toBe('unknown');
  expect(complete.uniqueIdentifier).toBe('unknown');
});

it('reports blank draft flows, unknown/none protection, and missing other explanations independently', () => {
  const flow = { ...defaultFlow('node', 'node'), id: 'flow' };
  const tab: DiagramTab = { id: 'tab', name: '', nodes: [complete], flows: [flow] };
  expect(validate(tab).map((warning) => warning.message)).toEqual(['검토 필요: 전달 흐름명 미지정', '검토 필요: 전달 흐름 개인정보 항목 미지정']);
  const named = { ...flow, name: '전달', dataItems: ['이름'] };
  expect(validate({ ...tab, flows: [named] }).map((warning) => warning.message)).toEqual(['검토 필요: 전송 보호조치 확인']);
  expect(validate({ ...tab, flows: [{ ...named, protection: 'none' }] }).map((warning) => warning.message)).toEqual(['검토 필요: 전송 보호조치 확인']);
  expect(validate({ ...tab, flows: [{ ...named, protection: 'tls' }] })).toEqual([]);
  expect(validate({ ...tab, flows: [{ ...named, protection: 'other' }] }).map((warning) => warning.message)).toEqual(['검토 필요: 기타 보호조치 설명 미지정']);
  expect(validate({ ...tab, flows: [{ ...named, protection: 'other', protectionNote: '조직별 조치' }] })).toEqual([]);
});

it('exempts external parties from activity fields, but still reviews names and stage details', () => {
  const tab: DiagramTab = { id: 'tab', name: '', nodes: [
    { ...defaultNode('subject', 'collect'), id: 'subject', name: '정보주체' },
    { ...defaultNode('recipient', 'delegate'), id: 'recipient', recipient: '가상 기관' },
  ], flows: [] };
  expect(validate(tab).map((warning) => warning.message)).toEqual(['검토 필요: 이름 미지정', '검토 필요: 위탁업무 미지정']);
});

it('counts an obstructed route alongside domain warnings, then clears it when moved', () => {
  const a = { ...complete, id: 'a', x: 0, y: 0 };
  const b = { ...complete, id: 'b', x: 680, y: 0 };
  const obstacle = { ...complete, id: 'obstacle', x: 200, y: 0 };
  const flow = { ...defaultFlow(a.id, b.id), id: 'flow', name: '전달', dataItems: ['이름'], protection: 'tls' as const };
  const tab: DiagramTab = { id: 'tab', name: '', nodes: [a, obstacle, b], flows: [flow] };
  expect(validate(tab)).toEqual([]);
  expect(reviewWarnings(tab)).toEqual([{ level: 'warn', flowId: 'flow', message: '연결선 경로의 노드 위치를 조정하세요' }]);
  const cleared: DiagramTab = { ...tab, nodes: tab.nodes.map(n => n.id === obstacle.id ? { ...n, x: 340, y: 250 } : n) };
  expect(reviewWarnings(cleared)).toEqual([]);
  const incomplete: DiagramTab = { ...cleared, nodes: cleared.nodes.map(n => n.id === a.id ? { ...n, owner: '' } : n) };
  expect(reviewWarnings(incomplete).map(w => w.message)).toEqual(['검토 필요: 담당자 미지정']);
});
