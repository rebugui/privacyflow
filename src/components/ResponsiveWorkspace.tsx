import { useLayoutEffect, useRef } from 'react';
import { useUiStore } from '../store/useUiStore';
import { useCompactLayout } from '../hooks/useCompactLayout';
import { LeftPanel } from './LeftPanel';
import { Canvas } from './Canvas';
import { RightPanel } from './RightPanel';

const regions = [
  { id: 'left', element: <LeftPanel /> },
  { id: 'canvas', element: <Canvas /> },
  { id: 'right', element: <RightPanel /> },
] as const;
const panels = [
  { id: 'canvas', label: '도면' },
  { id: 'left', label: '목록·추가' },
  { id: 'right', label: '속성·검토' },
] as const;
export function ResponsiveWorkspace() {
  const compact = useCompactLayout();
  const panel = useUiStore((state) => state.mobilePanel);
  const setPanel = useUiStore((state) => state.setMobilePanel);
  const nav = useRef<HTMLElement>(null);
  const previous = useRef(panel);
  useLayoutEffect(() => {
    if (compact && previous.current !== panel) {
      const inactive = document.getElementById(`workspace-${previous.current}`);
      if (document.activeElement && inactive?.contains(document.activeElement)) {
        nav.current?.querySelector<HTMLButtonElement>(`[aria-controls="workspace-${panel}"]`)?.focus();
      }
    }
    previous.current = panel;
  }, [compact, panel]);
  return <>
    <nav className="workspace-nav" aria-label="편집 화면" ref={nav} hidden={!compact}>
      {panels.map(({ id, label }) => <button key={id} type="button" aria-controls={`workspace-${id}`} aria-pressed={panel === id} onClick={() => {
        if (document.activeElement instanceof HTMLElement && document.getElementById(`workspace-${panel}`)?.contains(document.activeElement)) {
          nav.current?.querySelector<HTMLButtonElement>(`[aria-controls="workspace-${id}"]`)?.focus();
        }
        setPanel(id);
      }}>{label}</button>)}
    </nav>
    <div className="workspace">
      {regions.map(({ id, element }) => <div key={id} id={`workspace-${id}`} className={`workspace-region workspace-${id}`} inert={compact && panel !== id} style={compact && panel !== id ? { visibility: 'hidden' } : undefined}>{element}</div>)}
    </div>
  </>;
}
