import type { DataFlow, DiagramTab, FlowNode, Project } from '../types';

const invalid = (): never => { throw new Error('백업 데이터 구조가 올바르지 않습니다'); };
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return invalid();
  return value as Record<string, unknown>;
}
function string(value: unknown): string {
  if (typeof value !== 'string') return invalid();
  return value;
}
function strings<K extends string>(source: Record<string, unknown>, keys: readonly K[]): Record<K, string> {
  const result = {} as Record<K, string>;
  for (const key of keys) result[key] = string(source[key]);
  return result;
}
function array(value: unknown): unknown[] {
  if (!Array.isArray(value)) return invalid();
  return value;
}
function number(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return invalid();
  return value;
}
function enumeration<T extends string>(value: unknown, allowed: readonly T[]): T {
  if (typeof value !== 'string' || !allowed.includes(value as T)) return invalid();
  return value as T;
}
function port(value: unknown): DataFlow['sourceHandle'] {
  return value === null ? null : enumeration(value, ['top', 'bottom', 'left', 'right'] as const);
}

/** Rebuild only the known schema; incomplete text remains a valid editable draft. */
export function parseProject(value: unknown): Project {
  const source = object(value);
  if (source.app !== 'privacyflow') throw new Error('이 앱에서 만든 백업 파일이 아닙니다');
  if (source.schema !== 1) throw new Error('지원하지 않는 백업 버전입니다');
  const ids = new Set<string>();
  const id = (value: unknown): string => {
    const result = string(value);
    if (!result.trim() || result.startsWith('__') || ids.has(result)) return invalid();
    ids.add(result);
    return result;
  };
  const meta = strings(object(source.meta), ['docTitle', 'version', 'date', 'author', 'reviewer']);
  const revisions = array(source.revisions).map((value) => {
    const revision = object(value);
    return { id: id(revision.id), ...strings(revision, ['version', 'date', 'author', 'desc']) };
  });
  const tabs: DiagramTab[] = array(source.tabs).map((value) => {
    const tab = object(value);
    const tabId = id(tab.id);
    const nodes: FlowNode[] = array(tab.nodes).map((value) => {
      const node = object(value);
      return {
        id: id(node.id),
        kind: enumeration(node.kind, ['subject', 'activity', 'system', 'store', 'recipient'] as const),
        stage: enumeration(node.stage, ['collect', 'use', 'store', 'provide', 'delegate', 'destroy'] as const),
        ...strings(node, ['name', 'owner', 'systemName', 'purpose', 'legalBasis', 'retention', 'storageLocation', 'recipient', 'destinationCountry', 'entrustedTask', 'destructionMethod', 'safeguards', 'notes']),
        dataSubjects: array(node.dataSubjects).map(string),
        dataItems: array(node.dataItems).map(string),
        sensitive: enumeration(node.sensitive, ['unknown', 'yes', 'no'] as const),
        uniqueIdentifier: enumeration(node.uniqueIdentifier, ['unknown', 'yes', 'no'] as const),
        x: number(node.x), y: number(node.y),
      };
    });
    const nodeIds = new Set(nodes.map((node) => node.id));
    const flows: DataFlow[] = array(tab.flows).map((value) => {
      const flow = object(value);
      const result: DataFlow = {
        id: id(flow.id), ...strings(flow, ['from', 'to', 'name', 'method', 'frequency', 'protectionNote', 'notes']),
        dataItems: array(flow.dataItems).map(string), sourceHandle: port(flow.sourceHandle), targetHandle: port(flow.targetHandle),
        protection: enumeration(flow.protection, ['unknown', 'none', 'tls', 'vpn', 'other'] as const),
      };
      if (!nodeIds.has(result.from) || !nodeIds.has(result.to)) return invalid();
      return result;
    });
    return { id: tabId, name: string(tab.name), nodes, flows };
  });
  const activeTabId = string(source.activeTabId);
  if (!tabs.length || !tabs.some((tab) => tab.id === activeTabId)) return invalid();
  return { app: 'privacyflow', schema: 1, meta, revisions, tabs, activeTabId };
}
