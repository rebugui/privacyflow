import { createRoot } from "react-dom/client";
import {
  ReactFlow,
  ReactFlowProvider,
  ConnectionMode,
  getViewportForBounds,
} from "@xyflow/react";
import { toPng, toSvg } from "html-to-image";
import type { Project, DiagramTab } from "../../types";
import {
  sceneNodes,
  sceneEdges,
  nodeTypes,
  edgeTypes,
} from "../../components/scene";
import { diagramBounds } from "../geometry";
import { download, fileName } from "../download";
import { Ready } from "./ExportReady";
export async function captureTab(
  project: Project,
  tab: DiagramTab,
  format: "png" | "svg" = "png",
) {
  const nodes = sceneNodes(tab, project.meta).map((n) => ({
      ...n,
      width: Number(n.style!.width),
      height: Number(n.style!.height),
    })),
    edges = sceneEdges(tab);
  const bounds = diagramBounds(tab);
  const ratio = Math.min(
    1,
    2400 / Math.max(bounds.width + 80, bounds.height + 80),
  );
  const width = Math.ceil((bounds.width + 80) * ratio),
    height = Math.ceil((bounds.height + 80) * ratio),
    viewport = getViewportForBounds(bounds, width, height, 0.001, 2, 0.05);
  const host = document.createElement("div");
  host.className = "export-host";
  Object.assign(host.style, {
    position: "fixed",
    left: "-100000px",
    top: "0",
    width: `${width}px`,
    height: `${height}px`,
    background: "white",
    pointerEvents: "none",
  });
  document.body.append(host);
  const root = createRoot(host);
  try {
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error("내보내기 장면을 준비할 수 없습니다")),
        10000,
      );
      const done = () => {
        clearTimeout(timer);
        resolve();
      };
      root.render(
        <ReactFlowProvider>
          <ReactFlow
            defaultNodes={nodes}
            defaultEdges={edges}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            connectionMode={ConnectionMode.Loose}
            defaultViewport={viewport}
            minZoom={0.001}
            nodesDraggable={false}
            nodesConnectable={false}
            elementsSelectable={false}
          >
            <Ready done={done} />
          </ReactFlow>
        </ReactFlowProvider>,
      );
    });
    await document.fonts.ready;
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
    );
    const element = host.querySelector<HTMLElement>(".react-flow__viewport");
    if (!element) throw new Error("내보내기 화면이 없습니다");
    // html-to-image deep-clones SVG without decorating its descendants.
    // Inline label styles only in this disposable scene so foreignObject output
    // retains the same wrapping, background and fixed bounds as the live canvas.
    for (const label of element.querySelectorAll<HTMLElement | SVGElement>("svg foreignObject, svg foreignObject *")) {
      const computed = getComputedStyle(label);
      const styles = Array.from(computed, (name) => `${name}:${computed.getPropertyValue(name)}`).join(";");
      label.style.cssText = styles;
    }
    const data = await (format === "png" ? toPng : toSvg)(element, {
      width,
      height,
      backgroundColor: "#ffffff",
      pixelRatio: 2,
      style: {
        width: `${width}px`,
        height: `${height}px`,
        transform: `translate(${viewport.x}px,${viewport.y}px) scale(${viewport.zoom})`,
      },
      filter: (node) =>
        !(
          node instanceof Element &&
          node.classList.contains("react-flow__handle")
        ),
    });
    return { data, width, height };
  } finally {
    root.unmount();
    host.remove();
  }
}
export async function exportImage(project: Project, format: "png" | "svg") {
  const tab = project.tabs.find((t) => t.id === project.activeTabId);
  if (!tab) throw new Error("내보낼 장을 찾을 수 없습니다");
  const { data } = await captureTab(project, tab, format);
  download(data, fileName(project, tab.name, format));
}
