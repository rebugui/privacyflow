import type { DiagramTab, Warning } from '../types';

import { flowPath, routeWarningMessage } from './flowGeometry';
export function validate(tab: DiagramTab): Warning[] {
  const warnings: Warning[] = [];
  for (const node of tab.nodes) {
    const missing = (value: string | string[], label: string) => {
      if (typeof value === 'string' ? !value.trim() : !value.some((item) => item.trim())) warnings.push({ level: 'warn', nodeId: node.id, message: `검토 필요: ${label} 미지정` });
    };
    missing(node.name, '이름');
    if (node.kind !== 'subject' && node.kind !== 'recipient') {
      missing(node.owner, '담당자');
      missing(node.purpose, '처리목적');
      missing(node.dataItems, '개인정보 항목');
      missing(node.legalBasis, '법적근거');
    }
    if (node.stage === 'store') {
      missing(node.retention, '보유기간');
      missing(node.storageLocation, '보관위치');
    }
    if (node.stage === 'provide' || node.stage === 'delegate') missing(node.recipient, '상대기관');
    if (node.stage === 'delegate') missing(node.entrustedTask, '위탁업무');
    if (node.stage === 'destroy') missing(node.destructionMethod, '파기방법');
    if ((node.sensitive === 'yes' || node.uniqueIdentifier === 'yes') && !node.safeguards.trim()) {
      warnings.push({ level: 'warn', nodeId: node.id, message: '검토 필요: 민감정보/고유식별정보 보호조치 확인' });
    }
  }
  for (const flow of tab.flows) {
    if (!flow.name.trim()) warnings.push({ level: 'warn', flowId: flow.id, message: '검토 필요: 전달 흐름명 미지정' });
    const hasItems = flow.dataItems.some((item) => item.trim());
    if (!hasItems) warnings.push({ level: 'warn', flowId: flow.id, message: '검토 필요: 전달 흐름 개인정보 항목 미지정' });
    if (hasItems && (flow.protection === 'none' || flow.protection === 'unknown')) warnings.push({ level: 'warn', flowId: flow.id, message: '검토 필요: 전송 보호조치 확인' });
    if (flow.protection === 'other' && !flow.protectionNote.trim()) warnings.push({ level: 'warn', flowId: flow.id, message: '검토 필요: 기타 보호조치 설명 미지정' });
  }
  return warnings;
}

export function reviewWarnings(tab: DiagramTab): Warning[] {
  return [...validate(tab), ...tab.flows.flatMap((flow) => {
    const warning = flowPath(tab, flow).routeWarning;
    return warning ? [{ level: 'warn' as const, flowId: flow.id, message: routeWarningMessage(warning) }] : [];
  })];
}
