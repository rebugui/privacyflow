export type Port = 'top' | 'bottom' | 'left' | 'right';
export type Protection = 'unknown' | 'none' | 'tls' | 'vpn' | 'other';
export interface ProjectMeta { docTitle: string; version: string; date: string; author: string; reviewer: string; }
export interface Revision { id: string; version: string; date: string; author: string; desc: string; }
export interface DiagramTab { id: string; name: string; nodes: FlowNode[]; flows: DataFlow[]; }
export interface Warning { level: 'warn' | 'info'; nodeId?: string; flowId?: string; message: string; }
export type PrivacyStage = 'collect' | 'use' | 'store' | 'provide' | 'delegate' | 'destroy';
export type PrivacyNodeKind = 'subject' | 'activity' | 'system' | 'store' | 'recipient';
export type TriState = 'unknown' | 'yes' | 'no';
export interface FlowNode { id: string; kind: PrivacyNodeKind; stage: PrivacyStage; name: string; owner: string; systemName: string; purpose: string; dataSubjects: string[]; dataItems: string[]; sensitive: TriState; uniqueIdentifier: TriState; legalBasis: string; retention: string; storageLocation: string; recipient: string; destinationCountry: string; entrustedTask: string; destructionMethod: string; safeguards: string; notes: string; x: number; y: number; }
export interface DataFlow { id: string; from: string; to: string; sourceHandle: Port | null; targetHandle: Port | null; name: string; dataItems: string[]; method: string; frequency: string; protection: Protection; protectionNote: string; notes: string; }
export interface Project { app: 'privacyflow'; schema: 1; meta: ProjectMeta; revisions: Revision[]; tabs: DiagramTab[]; activeTabId: string; }
