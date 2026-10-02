import type { DataFlow, FlowNode, PrivacyNodeKind, PrivacyStage } from '../types';

export function defaultNode(kind: PrivacyNodeKind, stage: PrivacyStage): Omit<FlowNode, 'id'> {
  return {
    kind, stage, name: '', owner: '', systemName: '', purpose: '', dataSubjects: [], dataItems: [],
    sensitive: 'unknown', uniqueIdentifier: 'unknown', legalBasis: '', retention: '', storageLocation: '',
    recipient: '', destinationCountry: '', entrustedTask: '', destructionMethod: '', safeguards: '', notes: '', x: 0, y: 0,
  };
}
export function defaultFlow(from: string, to: string): Omit<DataFlow, 'id'> {
  return { from, to, sourceHandle: null, targetHandle: null, name: '', dataItems: [], method: '', frequency: '', protection: 'unknown', protectionNote: '', notes: '' };
}
export function splitItems(text: string): string[] {
  return text.split(/[\n,]/u).map((item) => item.trim()).filter(Boolean);
}
