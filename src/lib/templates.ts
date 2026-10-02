import type { FlowNode, Project } from '../types';
import { defaultFlow, defaultNode } from './defaults';
import { layoutDiagram } from './layout';

const synthetic = '합성 예시 — 실제 운영 설정이 아닙니다';
export function makeProject(template: boolean): Project {
  const id = crypto.randomUUID();
  let nodes: FlowNode[] = [];
  if (template) {
    const definitions = [
      ['subject', 'collect', '정보주체'],
      ['activity', 'collect', '회원정보 수집'],
      ['system', 'use', '회원관리'],
      ['store', 'store', '회원DB'],
      ['activity', 'destroy', '보유기간 종료 파기'],
      ['recipient', 'provide', '배송사'],
      ['recipient', 'delegate', '고객상담 수탁업체'],
    ] as const;
    nodes = definitions.map(([kind, stage, name]) => ({
      ...defaultNode(kind, stage), id: crypto.randomUUID(), name,
      owner: '가상 운영팀', systemName: kind === 'subject' || kind === 'recipient' ? '' : '가상 회원관리 시스템',
      purpose: stage === 'destroy' ? '보유기간 종료 항목 파기' : stage === 'provide' ? '가상 주문 배송' : stage === 'delegate' ? '가상 회원 고객상담' : '가상 회원관리',
      dataSubjects: ['회원'], dataItems: ['이름', '주소', '회원번호'],
      legalBasis: '예시 — 조직별 검토 필요', notes: synthetic,
      retention: stage === 'store' ? '예시 — 조직별 검토 필요' : '',
      storageLocation: stage === 'store' ? '가상 보관 위치 — 조직별 검토 필요' : '',
      recipient: stage === 'provide' ? '가상 배송사' : stage === 'delegate' ? '가상 고객상담사' : '',
      entrustedTask: stage === 'delegate' ? '가상 회원 문의 상담' : '',
      destructionMethod: stage === 'destroy' ? '예시 — 조직별 검토 필요' : '',
    }));
  }
  const connections = template ? [
    [0, 1, '회원정보 수집'], [1, 2, '회원정보 등록'], [2, 3, '회원정보 보관'],
    [3, 4, '파기 대상 전달'], [2, 5, '배송정보 제공'], [2, 6, '고객상담 위탁'],
  ] as const : [];
  const flows = connections.map(([from, to, name]) => ({
    ...defaultFlow(nodes[from].id, nodes[to].id), id: crypto.randomUUID(), name,
    dataItems: ['이름', '주소', '회원번호'], notes: synthetic,
  }));
  const tab = layoutDiagram({ id, name: '흐름도 1', nodes, flows });
  return {
    app: 'privacyflow', schema: 1,
    meta: { docTitle: template ? '개인정보 처리 흐름도 — 합성 예제' : '개인정보 처리 흐름도', version: '1.0', date: new Date().toLocaleDateString('en-CA'), author: '', reviewer: '' },
    revisions: [], tabs: [tab], activeTabId: id,
  };
}
