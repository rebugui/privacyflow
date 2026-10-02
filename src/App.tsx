import { useEffect, useRef, useState } from 'react';
import { ReactFlowProvider } from '@xyflow/react';
import { ResponsiveWorkspace } from './components/ResponsiveWorkspace';
import { TopBar } from './components/TopBar';
import { Toast } from './components/Toast';
import { DiagramTabs } from './components/DiagramTabs';
import { TemplateChoice } from './components/TemplateChoice';
import { useProjectStore, projectSnapshot } from './store/useProjectStore';
import { useUiStore } from './store/useUiStore';
import { registerStorageEvents, unlockStorage } from './lib/projectStorage';
import { download, fileName } from './lib/download';
import { HistoryShortcuts } from './components/HistoryShortcuts';
import './styles.css';

function backup() {
  const project = projectSnapshot();
  download(new Blob([JSON.stringify(project, null, 2)], { type: 'application/json' }), fileName(project, '전체', 'json'));
}
export default function App() {
  const ui = useUiStore();
  const allowUnload = useRef(false);
  const [welcome, setWelcome] = useState(() => ['empty', 'unavailable'].includes(useUiStore.getState().storageStatus));
  useEffect(() => registerStorageEvents(), []);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (!allowUnload.current && ['saving', 'failed', 'conflict', 'unsupported'].includes(useUiStore.getState().saveStatus)) {
        event.preventDefault();
        event.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, []);
  if (ui.storageStatus === 'blocked') return <div className="recovery"><h1>PrivacyFlow 저장 데이터 복구</h1><p>저장된 데이터의 형식 또는 버전을 읽을 수 없어 원본을 보존했습니다. 확인 전에는 자동 저장하거나 덮어쓰지 않습니다.</p><button onClick={() => download(new Blob([ui.rawBackup ?? ''], { type: 'text/plain;charset=utf-8' }), 'PrivacyFlow_복구원본.txt')}>원본 문자열 다운로드</button><button className="danger" onClick={() => {
    if (!confirm('복구 원본을 다운로드했나요? 기존 저장 데이터를 버리고 빈 프로젝트로 시작합니다.')) return;
    unlockStorage();
    useProjectStore.getState().resetProject(false);
    setWelcome(false);
  }}>새 프로젝트로 시작</button><p className="muted">복구 파일에 민감한 데이터가 포함될 수 있으므로 안전한 위치에 보관하세요.</p></div>;
  return <ReactFlowProvider><div className="app">
    <HistoryShortcuts /><TopBar />
    {ui.saveStatus !== 'saved' && <div className="save-banner" role="alert">
      {ui.saveStatus === 'saving' ? '저장 중…' : ui.saveStatus === 'conflict' ? '다른 탭에서 데이터가 변경되었습니다. 이 탭의 자동 저장을 중지했습니다.' : ui.saveStatus === 'unsupported' ? '이 브라우저에서는 안전한 자동 저장을 사용할 수 없습니다 — JSON 백업을 저장하세요' : '자동 저장 실패 — JSON 백업을 저장하세요'}
      {ui.saveStatus === 'conflict' ? <><button onClick={backup}>현재 편집 JSON 백업</button><button onClick={() => {
        if (!confirm('현재 편집 내용을 백업했나요? 저장된 최신 내용을 불러오면 이 탭의 미저장 편집이 사라집니다.')) return;
        allowUnload.current = true;
        window.location.reload();
      }}>최신 내용 다시 불러오기</button></> : ui.saveStatus !== 'saving' && <button onClick={backup}>현재 편집 JSON 백업</button>}
    </div>}
    <DiagramTabs /><ResponsiveWorkspace /><Toast />
    {welcome && <TemplateChoice title="PrivacyFlow 시작하기" onClose={() => { useProjectStore.getState().resetProject(false); setWelcome(false); }} onChoose={(template) => { useProjectStore.getState().resetProject(template); setWelcome(false); }} />}
  </div></ReactFlowProvider>;
}
