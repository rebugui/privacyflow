import { useState } from "react";
import type { DataFlow, FlowNode, PrivacyNodeKind, PrivacyStage, Protection, TriState } from "../types";
import { kindDefs, stageDefs, protectionLabels, triStateLabels } from "../lib/nodeTypes";
import { defaultFlow, splitItems } from "../lib/defaults";

export type NodeValues = Omit<FlowNode, "id" | "x" | "y">;
type StageField = "retention" | "storageLocation" | "recipient" | "destinationCountry" | "entrustedTask" | "destructionMethod";
const stageFields: { key: StageField; label: string; stages: PrivacyStage[] }[] = [
  { key: "retention", label: "보유기간", stages: ["store"] },
  { key: "storageLocation", label: "보관위치", stages: ["store"] },
  { key: "recipient", label: "상대 기관", stages: ["provide", "delegate"] },
  { key: "destinationCountry", label: "목적지 국가", stages: ["provide", "delegate"] },
  { key: "entrustedTask", label: "위탁업무", stages: ["delegate"] },
  { key: "destructionMethod", label: "파기방법", stages: ["destroy"] },
];
const commonFields = [
  ["owner", "담당자"], ["systemName", "시스템명"], ["purpose", "처리 목적"],
  ["legalBasis", "법적 근거"], ["safeguards", "보호조치"], ["notes", "메모"],
] as const;

export function NodeForm({ initial, onSave, submitLabel = "처리 활동 추가" }: {
  initial?: FlowNode; onSave: (node: NodeValues) => void; submitLabel?: string;
}) {
  const [kind, setKind] = useState<PrivacyNodeKind | "">(initial?.kind ?? "");
  const [stage, setStage] = useState<PrivacyStage | "">(initial?.stage ?? "");
  const [fields, setFields] = useState({
    name: initial?.name ?? "", owner: initial?.owner ?? "", systemName: initial?.systemName ?? "",
    purpose: initial?.purpose ?? "", legalBasis: initial?.legalBasis ?? "", retention: initial?.retention ?? "",
    storageLocation: initial?.storageLocation ?? "", recipient: initial?.recipient ?? "",
    destinationCountry: initial?.destinationCountry ?? "", entrustedTask: initial?.entrustedTask ?? "",
    destructionMethod: initial?.destructionMethod ?? "", safeguards: initial?.safeguards ?? "", notes: initial?.notes ?? "",
  });
  const [subjects, setSubjects] = useState(initial?.dataSubjects.join("\n") ?? "");
  const [items, setItems] = useState(initial?.dataItems.join("\n") ?? "");
  const [sensitive, setSensitive] = useState<TriState>(initial?.sensitive ?? "unknown");
  const [uniqueIdentifier, setUniqueIdentifier] = useState<TriState>(initial?.uniqueIdentifier ?? "unknown");
  const field = (key: keyof typeof fields, label: string, multiline = false) => (
    <label key={key}>{label}{multiline
      ? <textarea rows={3} value={fields[key]} onChange={(e) => setFields({ ...fields, [key]: e.target.value })} />
      : <input value={fields[key]} onChange={(e) => setFields({ ...fields, [key]: e.target.value })} />}</label>
  );
  const preserved = stageFields.filter((f) => (!stage || !f.stages.includes(stage)) && fields[f.key]);
  return <form className="form" onSubmit={(e) => {
    e.preventDefault();
    if (!kind || !stage || !fields.name.trim()) return;
    onSave({ ...fields, name: fields.name.trim(), kind, stage, dataSubjects: splitItems(subjects), dataItems: splitItems(items), sensitive, uniqueIdentifier });
  }}>
    <label>이름 *<input required value={fields.name} onChange={(e) => setFields({ ...fields, name: e.target.value })} /></label>
    <label>종류 *<select required value={kind} onChange={(e) => setKind(e.target.value as PrivacyNodeKind | "")}>
      <option value="">종류를 선택하세요</option>{Object.entries(kindDefs).map(([id, d]) => <option key={id} value={id}>{d.label}</option>)}
    </select></label>
    <label>처리 단계 *<select required value={stage} onChange={(e) => setStage(e.target.value as PrivacyStage | "")}>
      <option value="">단계를 선택하세요</option>{Object.entries(stageDefs).map(([id, d]) => <option key={id} value={id}>{d.label}</option>)}
    </select></label>
    <p className="muted">실제 개인정보 값이 아닌 항목명과 처리 활동만 기록하세요.</p>
    <label>주체 유형 · 줄바꿈 또는 쉼표 구분<textarea rows={2} value={subjects} onChange={(e) => setSubjects(e.target.value)} /></label>
    <label>개인정보 항목명 · 줄바꿈 또는 쉼표 구분<textarea rows={3} value={items} onChange={(e) => setItems(e.target.value)} /></label>
    {commonFields.map(([key, label]) => field(key, label, key === "purpose" || key === "legalBasis" || key === "safeguards" || key === "notes"))}
    <div className="form-row">
      <label>민감정보 포함<select value={sensitive} onChange={(e) => setSensitive(e.target.value as TriState)}>{Object.entries(triStateLabels).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label>
      <label>고유식별정보 포함<select value={uniqueIdentifier} onChange={(e) => setUniqueIdentifier(e.target.value as TriState)}>{Object.entries(triStateLabels).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label>
    </div>
    {stage && stageFields.filter((f) => f.stages.includes(stage)).map((f) => field(f.key, f.label, true))}
    {preserved.length > 0 && <details className="preserved"><summary>이전 단계의 보존 값 ({preserved.length})</summary><p className="muted">현재 단계에 적용하지 않지만 JSON·PPTX에 보존합니다. 단계 변경으로 삭제되지 않습니다.</p>{preserved.map((f) => field(f.key, f.label, true))}</details>}
    <p className="muted">법적 근거와 보유기간은 조직별로 검토하세요. 이 도면은 법적 적합성을 자동 판단하지 않습니다.</p>
    <button className="primary" disabled={!kind || !stage || !fields.name.trim()}>{submitLabel}</button>
  </form>;
}

export function FlowForm({ initial, nodes, onSave, submitLabel = "전달 흐름 추가" }: {
  initial?: DataFlow; nodes: FlowNode[]; onSave: (flow: Omit<DataFlow, "id">) => void; submitLabel?: string;
}) {
  const [value, setValue] = useState<Omit<DataFlow, "id">>(initial ?? defaultFlow("", ""));
  const [items, setItems] = useState(initial?.dataItems.join("\n") ?? "");
  const valid = Boolean(value.name.trim() && nodes.some((n) => n.id === value.from) && nodes.some((n) => n.id === value.to));
  return <form className="form" onSubmit={(e) => {
    e.preventDefault();
    if (valid) onSave({ ...value, name: value.name.trim(), dataItems: splitItems(items) });
  }}>
    {(["from", "to"] as const).map((key) => <label key={key}>{key === "from" ? "출발" : "도착"} *<select required value={value[key]} onChange={(e) => setValue({ ...value, [key]: e.target.value, [key === "from" ? "sourceHandle" : "targetHandle"]: null })}>
      <option value="">노드를 선택하세요</option>{nodes.map((node) => <option key={node.id} value={node.id}>{node.name || "미지정"} · {stageDefs[node.stage].label}</option>)}
    </select></label>)}
    <label>흐름명 *<input required value={value.name} onChange={(e) => setValue({ ...value, name: e.target.value })} /></label>
    <label>개인정보 항목명 · 줄바꿈 또는 쉼표 구분<textarea rows={3} value={items} onChange={(e) => setItems(e.target.value)} /></label>
    <label>전달 방식<input value={value.method} onChange={(e) => setValue({ ...value, method: e.target.value })} /></label>
    <label>전달 주기<input value={value.frequency} onChange={(e) => setValue({ ...value, frequency: e.target.value })} /></label>
    <label>전송 보호조치<select value={value.protection} onChange={(e) => setValue({ ...value, protection: e.target.value as Protection })}>{Object.entries(protectionLabels).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label>
    <label>보호조치 설명<textarea rows={2} value={value.protectionNote} onChange={(e) => setValue({ ...value, protectionNote: e.target.value })} /></label>
    <label>메모<textarea rows={3} value={value.notes} onChange={(e) => setValue({ ...value, notes: e.target.value })} /></label>
    <p className="muted">출발 → 도착의 방향 흐름입니다. 반대 방향은 별도 흐름으로 추가하세요.</p>
    <button className="primary" disabled={!valid}>{submitLabel}</button>
  </form>;
}
