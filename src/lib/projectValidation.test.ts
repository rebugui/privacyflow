import { expect, it } from 'vitest';
import type { Project } from '../types';
import { defaultFlow } from './defaults';
import { makeProject } from './templates';
import { parseProject } from './projectValidation';

it('preserves every field, hidden-stage detail, unknown tri-state, and parallel/self flows through JSON', () => {
  const project = makeProject(true);
  const node = project.tabs[0].nodes[0];
  Object.assign(node, {
    name: '<script>not executable</script>', owner: '담당자', systemName: '공유 시스템', purpose: '처리 목적',
    dataSubjects: ['회원', '담당자'], dataItems: ['이름', '주소'], sensitive: 'unknown', uniqueIdentifier: 'yes',
    legalBasis: '검토 근거', retention: '보존 기간', storageLocation: '보관 위치', recipient: '상대 기관',
    destinationCountry: '국가', entrustedTask: '이전 위탁업무', destructionMethod: '이전 파기방법', safeguards: '보호조치', notes: '긴 메모'.repeat(500), x: -13.5, y: 200.25,
  });
  const flow = project.tabs[0].flows[0];
  Object.assign(flow, { sourceHandle: 'top', targetHandle: 'bottom', method: '전달 방식', frequency: '주기', protection: 'other', protectionNote: '보호 설명', notes: '전달 메모', dataItems: ['회원번호', '주소'] });
  project.tabs[0].flows.push({ ...flow, id: 'parallel' }, { ...flow, id: 'reverse', from: flow.to, to: flow.from }, { ...defaultFlow(node.id, node.id), id: 'self', sourceHandle: 'left', targetHandle: 'left' });
  project.revisions.push({ id: 'revision', version: '2', date: '2026-10-02', author: '작성자', desc: '변경 설명' });
  const parsed = parseProject(JSON.parse(JSON.stringify(project)));
  expect(parsed).toEqual(project);
  parsed.tabs[0].nodes[0].dataItems.push('다른 항목');
  expect(project.tabs[0].nodes[0].dataItems).toEqual(['이름', '주소']);
});

it('reconstructs only known fields at every level without coercing empty drafts', () => {
  const project = makeProject(true);
  project.tabs[0].nodes[0].name = '';
  const noisy = structuredClone(project);
  Object.assign(noisy, { unknown: true });
  Object.assign(noisy.meta, { unknown: true });
  Object.assign(noisy.tabs[0], { unknown: true });
  Object.assign(noisy.tabs[0].nodes[0], { unknown: true });
  Object.assign(noisy.tabs[0].flows[0], { unknown: true });
  expect(parseProject(noisy)).toEqual(project);
});

it.each([
  ['foreign app', (p: Project) => Object.assign(p, { app: 'infoflow' }), '이 앱에서 만든 백업 파일이 아닙니다'],
  ['unsupported schema', (p: Project) => Object.assign(p, { schema: 2 }), '지원하지 않는 백업 버전입니다'],
  ['duplicate across revisions and nodes', (p: Project) => p.revisions.push({ id: p.tabs[0].nodes[0].id, version: '', date: '', author: '', desc: '' }), '백업 데이터 구조가 올바르지 않습니다'],
  ['reserved id', (p: Project) => { p.tabs[0].nodes[0].id = '__title'; }, '백업 데이터 구조가 올바르지 않습니다'],
  ['empty id', (p: Project) => { p.tabs[0].id = ''; p.activeTabId = ''; }, '백업 데이터 구조가 올바르지 않습니다'],
  ['missing endpoint', (p: Project) => { p.tabs[0].flows[0].to = 'absent'; }, '백업 데이터 구조가 올바르지 않습니다'],
  ['nonfinite coordinate', (p: Project) => { p.tabs[0].nodes[0].x = NaN; }, '백업 데이터 구조가 올바르지 않습니다'],
  ['wrong tri-state', (p: Project) => Object.assign(p.tabs[0].nodes[0], { sensitive: false }), '백업 데이터 구조가 올바르지 않습니다'],
  ['missing handle', (p: Project) => Reflect.deleteProperty(p.tabs[0].flows[0], 'sourceHandle'), '백업 데이터 구조가 올바르지 않습니다'],
  ['absent active tab', (p: Project) => { p.activeTabId = 'absent'; }, '백업 데이터 구조가 올바르지 않습니다'],
  ['no tabs', (p: Project) => { p.tabs = []; }, '백업 데이터 구조가 올바르지 않습니다'],
] as const)('rejects %s', (_name, mutate, message) => {
  const project = makeProject(true);
  mutate(project);
  expect(() => parseProject(project)).toThrow(message);
});

it('rejects endpoints in another tab and IDs duplicated across tabs', () => {
  const project = makeProject(true);
  const second = makeProject(true).tabs[0];
  project.tabs.push(second);
  project.tabs[0].flows[0].to = second.nodes[0].id;
  expect(() => parseProject(project)).toThrow('백업 데이터 구조가 올바르지 않습니다');
  project.tabs[0].flows[0].to = project.tabs[0].nodes[1].id;
  second.flows[0].id = project.tabs[0].id;
  expect(() => parseProject(project)).toThrow('백업 데이터 구조가 올바르지 않습니다');
});
