import { useEffect, useRef, useState } from 'react';
import { useReactFlow } from '@xyflow/react';
import { useProjectStore, projectSnapshot } from '../store/useProjectStore';
import { useUiStore } from '../store/useUiStore';
import { undo, redo } from '../store/projectHistory';
import { layoutDiagram } from '../lib/layout';
import { parseProject } from '../lib/projectValidation';
import { download, fileName } from '../lib/download';
import { useCompactLayout } from '../hooks/useCompactLayout';
import { MetaModal } from './MetaModal';
import { TemplateChoice } from './TemplateChoice';
import { ExportMenu } from './ExportMenu';
import { Modal } from './Modal';
export function TopBar() {
  const s = useProjectStore();
  const ui = useUiStore();
  const flow = useReactFlow();
  const input = useRef<HTMLInputElement>(null);
  const toolbar = useRef<HTMLElement>(null);
  const menuButton = useRef<HTMLButtonElement>(null);
  const compact = useCompactLayout();
  const [menuOpen, setMenuOpen] = useState(false);
  const [modal, setModal] = useState<'meta' | 'new' | 'storage' | null>(null);
  useEffect(() => {
    if (!compact || !menuOpen) return;
    const pointer = (event: PointerEvent) => { if (event.target instanceof Node && !toolbar.current?.contains(event.target)) setMenuOpen(false); };
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') { setMenuOpen(false); menuButton.current?.focus(); } };
    document.addEventListener('pointerdown', pointer);
    document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('pointerdown', pointer); document.removeEventListener('keydown', escape); };
  }, [compact, menuOpen]);
  const closeMenu = () => { if (compact) { menuButton.current?.focus(); setMenuOpen(false); } };
  return <><header className="topbar" ref={toolbar}><b>PrivacyFlow</b><a className="author-credit" href="https://github.com/rebugui/privacyflow" target="_blank" rel="noreferrer" title="GitHub 저장소 — rebugui/privacyflow"><svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" fill="currentColor"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8z"/></svg><span className="credit-name">rebugui</span></a><span className="top-title" title={s.meta.docTitle}>{s.meta.docTitle}</span>
    <div className="topbar-primary"><button title="Ctrl/Cmd+Z" onClick={() => ui.notify(undo() ? '실행을 취소했습니다' : '취소할 작업이 없습니다')}>실행 취소</button><button title="Ctrl/Cmd+Shift+Z" onClick={() => ui.notify(redo() ? '다시 실행했습니다' : '다시 실행할 작업이 없습니다')}>다시 실행</button><button className="topbar-menu-toggle" ref={menuButton} aria-expanded={menuOpen} aria-controls="topbar-actions" onClick={() => setMenuOpen(!menuOpen)}>메뉴</button></div>
    <div id="topbar-actions" className="topbar-actions" role="region" aria-label="문서 및 내보내기 작업" hidden={compact && !menuOpen} inert={compact && !menuOpen}>
      <button onClick={() => { closeMenu(); setModal('storage'); }}>저장 안내</button><button onClick={() => { closeMenu(); setModal('meta'); }}>문서 정보</button>
      <button onClick={() => { if (confirm('수동 조정한 위치가 단계별 자동 배치로 바뀝니다. 계속할까요?')) { s.updateTab(layoutDiagram(s.tabs.find((t) => t.id === s.activeTabId)!)); setTimeout(() => void flow.fitView({ padding: 0.15 }), 100); } }}>자동 배치</button><ExportMenu />
      <button onClick={() => { const p = projectSnapshot(); download(new Blob([JSON.stringify(p, null, 2)], { type: 'application/json' }), fileName(p, '전체', 'json')); }}>JSON 백업 저장</button>
      <button onClick={() => { closeMenu(); input.current?.click(); }}>JSON 불러오기</button><button onClick={() => { closeMenu(); setModal('new'); }}>새 프로젝트</button>
    </div>
    <input hidden ref={input} type="file" accept=".json,application/json" aria-label="PrivacyFlow JSON 백업 선택" onChange={async (e) => {
      const file = e.target.files?.[0]; e.target.value = ''; if (!file) return;
      try {
        let value: unknown;
        try { value = JSON.parse(await file.text()); } catch { throw new Error('백업 데이터 구조가 올바르지 않습니다'); }
        const project = parseProject(value);
        if (!confirm('현재 프로젝트를 이 JSON 백업으로 교체합니다. 필요한 경우 현재 JSON 백업을 먼저 저장하세요. 계속할까요?')) return;
        useProjectStore.getState().replaceProject(project);
        ui.notify('프로젝트를 복원했습니다. 실행 취소로 이전 프로젝트를 복구할 수 있습니다.');
        setTimeout(() => void flow.fitView({ padding: 0.15 }), 100);
      } catch (error) { ui.notify(error instanceof Error ? error.message : 'JSON 복원 실패'); }
    }} />
  </header>
  {modal === 'meta' && <MetaModal onClose={() => setModal(null)} />}
  {modal === 'new' && <TemplateChoice title="새 프로젝트" onClose={() => setModal(null)} onChoose={(template) => { if (!confirm('현재 프로젝트가 초기화됩니다. 필요한 경우 JSON 백업을 먼저 저장하세요. 계속할까요?')) return; s.resetProject(template); setModal(null); }} />}
  {modal === 'storage' && <Modal title="로컬 저장 · 개인정보 안내" onClose={() => setModal(null)}><div className="form"><p>실제 개인정보 값은 입력하지 말고 개인정보 항목명과 처리 활동만 작성하세요. 편집 데이터는 외부 API나 AI 서비스에 전송하지 않습니다.</p><p>브라우저 자동 저장(localStorage)과 JSON 백업은 평문입니다. 같은 브라우저 프로필·origin의 다른 스크립트가 접근할 수 있습니다. 앱별 저장 키는 충돌 방지이며 접근통제가 아닙니다.</p><p>안전한 자동 저장은 Web Locks를 지원하는 브라우저의 업데이트된 앱 탭끼리만 협조합니다. 이전 버전의 탭과 동시에 편집하지 마세요. 저장 실패·충돌·미지원 환경에서는 현재 편집 내용을 JSON으로 백업하세요.</p><p>암호화 저장, 로그인, 서버 동기화는 제공하지 않습니다. 브라우저 데이터 삭제 시 작업을 잃을 수 있으므로 JSON 백업을 별도로 보관하세요.</p><p>PNG·SVG·PDF는 도면 출력입니다. 전체 상세 속성을 보존하려면 JSON 또는 PPTX를 사용하세요. 도면은 법적 적합성이나 인증을 자동 보장하지 않습니다.</p></div></Modal>}
  </>;
}
