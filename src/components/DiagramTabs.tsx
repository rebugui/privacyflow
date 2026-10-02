import { useState } from "react";
import { useProjectStore } from "../store/useProjectStore";
import { TemplateChoice } from "./TemplateChoice";
import { Modal } from "./Modal";
export function DiagramTabs() {
  const s = useProjectStore();
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<{ id: string; name: string } | null>(null);
  const [context, setContext] = useState<{ id: string; x: number; y: number } | null>(null);
  return <>
    <nav className="diagram-tabs" aria-label="흐름도 탭">{s.tabs.map((tab) => <div key={tab.id} className={`tab ${s.activeTabId === tab.id ? "active" : ""}`} onContextMenu={(e) => { e.preventDefault(); setContext({ id: tab.id, x: e.clientX, y: e.clientY }); }}>
      <button aria-current={s.activeTabId === tab.id ? "page" : undefined} onClick={() => s.setActiveTab(tab.id)} onDoubleClick={() => setEditing({ id: tab.id, name: tab.name })}>{tab.name}</button>
      <button aria-label={`${tab.name} 삭제`} disabled={s.tabs.length === 1} onClick={() => { if (confirm(`“${tab.name}” 장과 포함된 활동·흐름을 삭제할까요?`)) s.removeTab(tab.id); }}>×</button>
    </div>)}<button className="add-tab" aria-label="흐름도 추가" onClick={() => setAdding(true)}>＋</button><button onClick={() => { const tab = s.tabs.find((t) => t.id === s.activeTabId)!; setEditing({ id: tab.id, name: tab.name }); }}>이름 변경</button><button onClick={() => s.dupTab(s.activeTabId)}>현재 장 복제</button><span className="tabs-hint">더블클릭: 이름 · 우클릭: 복제</span></nav>
    {adding && <TemplateChoice title="새 흐름도" onClose={() => setAdding(false)} onChoose={(template) => { s.addTab(template); setAdding(false); }} />}
    {editing && <Modal title="흐름도 이름" onClose={() => setEditing(null)}><form className="form" onSubmit={(e) => { e.preventDefault(); if (!editing.name.trim()) return; s.renameTab(editing.id, editing.name.trim()); setEditing(null); }}><label>장 이름<input required value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></label><button className="primary">이름 적용</button></form></Modal>}
    {context && <div className="context-backdrop" onClick={() => setContext(null)}><div className="context-menu" style={{ left: Math.min(context.x, window.innerWidth - 170), top: Math.min(context.y, window.innerHeight - 120) }}><button onClick={() => s.dupTab(context.id)}>흐름도 복제</button><button onClick={() => { const tab = s.tabs.find((t) => t.id === context.id)!; setEditing({ id: tab.id, name: tab.name }); }}>이름 변경</button></div></div>}
  </>;
}
