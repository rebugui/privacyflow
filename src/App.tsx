import { useState } from "react";
import { ReactFlowProvider } from "@xyflow/react";
import { Canvas } from "./components/Canvas";
import { LeftPanel } from "./components/LeftPanel";
import { RightPanel } from "./components/RightPanel";
import { TopBar } from "./components/TopBar";
import { Toast } from "./components/Toast";
import { DiagramTabs } from "./components/DiagramTabs";
import { TemplateChoice } from "./components/TemplateChoice";
import { useProjectStore } from "./store/useProjectStore";
import { useUiStore } from "./store/useUiStore";
import { unlockStorage } from "./lib/projectStorage";
import { download } from "./lib/download";
import { HistoryShortcuts } from "./components/HistoryShortcuts";
import "./styles.css";

export default function App() {
  const ui = useUiStore();
  const [welcome, setWelcome] = useState(() => ["empty", "unavailable"].includes(useUiStore.getState().storageStatus));
  if (ui.storageStatus === "blocked") return <div className="recovery"><h1>PrivacyFlow 저장 데이터 복구</h1><p>저장된 데이터의 형식 또는 버전을 읽을 수 없어 원본을 보존했습니다. 확인 전에는 자동 저장하거나 덮어쓰지 않습니다.</p><button onClick={() => download(new Blob([ui.rawBackup ?? ""], { type: "text/plain;charset=utf-8" }), "PrivacyFlow_복구원본.txt")}>원본 문자열 다운로드</button><button className="danger" onClick={() => {
    if (!confirm("복구 원본을 다운로드했나요? 기존 저장 데이터를 버리고 빈 프로젝트로 시작합니다.")) return;
    unlockStorage();
    useProjectStore.getState().resetProject(false);
    setWelcome(false);
  }}>새 프로젝트로 시작</button><p className="muted">복구 파일에 민감한 데이터가 포함될 수 있으므로 안전한 위치에 보관하세요.</p></div>;
  return <ReactFlowProvider><div className="app">
    <HistoryShortcuts /><TopBar />
    {(ui.saveError || ui.storageStatus === "unavailable") && <div className="save-banner" role="alert">자동 저장 실패 — JSON 백업을 저장하세요. 현재 편집 상태는 메모리에 유지됩니다.</div>}
    <DiagramTabs /><div className="workspace"><LeftPanel /><Canvas /><RightPanel /></div><Toast />
    {welcome && <TemplateChoice title="PrivacyFlow 시작하기" onClose={() => { useProjectStore.getState().resetProject(false); setWelcome(false); }} onChoose={(template) => { useProjectStore.getState().resetProject(template); setWelcome(false); }} />}
  </div></ReactFlowProvider>;
}
