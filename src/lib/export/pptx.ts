import PptxGenJS from "pptxgenjs";
import type { Project, DiagramTab, FlowNode, DataFlow } from "../../types";
import { NODE_WIDTH, NODE_HEIGHT, nodeStyle, nodeLines, flowLines, legendItems, kindDefs, stageDefs, protectionLabels, triStateLabels, portLabels } from "../nodeTypes";
import type { NodeShape } from "../nodeTypes";
import { diagramBounds, legendBox } from "../geometry";
import { flowPath, routeWarningMessage } from "../flowGeometry";
import { fileName } from "../download";

const FONT = "Malgun Gothic";
const COLUMN_WIDTHS = [0.8, 2, 9.73];
const BODY_HEIGHT = 5.8;
const HEADER_HEIGHT = 0.34;
const nodeFields: Record<keyof FlowNode, string> = {
  id: "ID", kind: "종류", stage: "처리 단계", name: "이름", owner: "담당자",
  systemName: "시스템명", purpose: "처리 목적", dataSubjects: "주체 유형", dataItems: "개인정보 항목",
  sensitive: "민감정보 포함 여부", uniqueIdentifier: "고유식별정보 포함 여부", legalBasis: "법적 근거",
  retention: "보유기간", storageLocation: "보관위치", recipient: "상대 기관", destinationCountry: "목적지 국가",
  entrustedTask: "위탁업무", destructionMethod: "파기방법", safeguards: "보호조치", notes: "메모",
  x: "X 좌표", y: "Y 좌표",
};
const flowFields: Record<keyof DataFlow, string> = {
  id: "ID", from: "출발 노드 ID", to: "도착 노드 ID", sourceHandle: "출발 포트",
  targetHandle: "도착 포트", name: "흐름명", dataItems: "개인정보 항목", method: "전달방법",
  frequency: "주기", protection: "보호조치",
  protectionNote: "보호조치 설명", notes: "메모",
};
type Attribute = { reference: string; field: string; value: string };
type WrappedRow = { reference: string; fields: string[]; lines: string[]; height: number };

const lookup: Record<string, Record<string, string>> = {
  kind: Object.fromEntries(Object.entries(kindDefs).map(([id, def]) => [id, def.label])),
  stage: Object.fromEntries(Object.entries(stageDefs).map(([id, def]) => [id, def.label])),
  sensitive: triStateLabels, uniqueIdentifier: triStateLabels, protection: protectionLabels,
  sourceHandle: portLabels, targetHandle: portLabels,
};
function displayValue(key: string, value: unknown): string {
  if (value === null) return key === 'sourceHandle' || key === 'targetHandle' ? '자동 (null)' : 'null';
  if (typeof value === 'string' && lookup[key]?.[value]) return `${lookup[key][value]} (${value})`;
  return String(value);
}
function attributes(reference: string, values: object, labels: Record<string, string>): Attribute[] {
  return Object.entries(values).flatMap(([key, value]) => {
    const field = labels[key] ?? key;
    if (Array.isArray(value)) {
      return value.length
        ? value.map((item: string, index: number) => ({ reference, field: `${field} [${index + 1}]`, value: item }))
        : [{ reference, field, value: "[]" }];
    }
    return [{ reference, field, value: displayValue(key, value) }];
  });
}

// Deliberate Unicode-code-point wrapping: no trim, ellipsis or discarded empty lines.
// Soft wrapping is represented by run breaks, so joining a:t runs restores long values.
function wrapValue(value: string, limit = 60): string[] {
  const lines: string[] = [];
  let line = "";
  let length = 0;
  for (const char of value) {
    if (length === limit) {
      lines.push(line);
      line = "";
      length = 0;
    }
    line += char;
    length++;
    if (char === "\n") {
      lines.push(line);
      line = "";
      length = 0;
    }
  }
  if (line || !lines.length || value.endsWith("\n")) lines.push(line);
  return lines;
}

function attributeSlides(pptx: PptxGenJS, title: string, values: Attribute[]) {
  const rows: WrappedRow[] = [];
  for (const value of values) {
    const lines = wrapValue(value.value);
    for (let start = 0; start < lines.length; start += 12) {
      const chunk = lines.slice(start, start + 12);
      const fields = wrapValue(`${value.field}${start ? " (계속)" : ""}`, 12);
      rows.push({
        reference: value.reference,
        fields,
        lines: chunk,
        height: 0.22 * Math.max(chunk.length, fields.length) + 0.12,
      });
    }
  }
  if (!rows.length) rows.push({ reference: "—", fields: ["안내"], lines: ["등록된 항목이 없습니다"], height: 0.34 });
  let cursor = 0;
  while (cursor < rows.length) {
    const slide = pptx.addSlide();
    slide.background = { color: "FFFFFF" };
    slide.addText(title, { x: 0.4, y: 0.4, w: 12.53, h: 0.3, margin: 0, fontFace: FONT, fontSize: 10, bold: true, color: "132E54" });
    const page: PptxGenJS.TableRow[] = [["참조", "항목", "값"].map((text) => ({
      text, options: { bold: true, fill: { color: "E8EEF5" } },
    }))];
    const heights = [HEADER_HEIGHT];
    let used = 0;
    while (cursor < rows.length && used + rows[cursor].height <= BODY_HEIGHT) {
      const row = rows[cursor++];
      page.push([
        { text: row.reference },
        { text: row.fields.map((text, index) => ({ text, options: { breakLine: index < row.fields.length - 1 } })) },
        { text: row.lines.map((text, index) => ({ text, options: { breakLine: index < row.lines.length - 1 } })) },
      ]);
      heights.push(row.height);
      used += row.height;
    }
    slide.addTable(page, {
      x: 0.4, y: 0.9, w: 12.53, h: HEADER_HEIGHT + used,
      colW: COLUMN_WIDTHS, rowH: heights, fontFace: FONT, fontSize: 10,
      margin: [0.06, 0.06, 0.06, 0.06], valign: "top",
      border: { pt: 0.5, color: "BCCBDF" }, color: "172B4D",
      autoPage: false,
    });
  }
}


function nodeAttributes(node: FlowNode, reference: string): Attribute[] {
  const stageFields: Partial<Record<keyof FlowNode, FlowNode["stage"][]>> = {
    retention: ["store"], storageLocation: ["store"], recipient: ["provide", "delegate"],
    destinationCountry: ["provide", "delegate"], entrustedTask: ["delegate"], destructionMethod: ["destroy"],
  };
  const current: Record<string, unknown> = {};
  const retained: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(node)) {
    const stages = stageFields[key as keyof FlowNode];
    (stages && !stages.includes(node.stage) ? retained : current)[key] = value;
  }
  return [
    ...attributes(reference, current, nodeFields),
    { reference, field: "보존 값 안내", value: "현재 단계 비적용 — 보존 값" },
    ...attributes(reference, retained, nodeFields),
  ];
}

function diagramSlide(pptx: PptxGenJS, project: Project, tab: DiagramTab) {
  const slide = pptx.addSlide();
  slide.background = { color: "FFFFFF" };
  const bounds = diagramBounds(tab);
  const scale = Math.min(12.53 / bounds.width, 6.7 / bounds.height);
  const offsetX = 0.4 + (12.53 - bounds.width * scale) / 2;
  const offsetY = 0.4 + (6.7 - bounds.height * scale) / 2;
  const X = (x: number) => offsetX + (x - bounds.x) * scale;
  const Y = (y: number) => offsetY + (y - bounds.y) * scale;
  const text = (value: string, x: number, y: number, w: number, h: number, extra: PptxGenJS.TextPropsOptions = {}) => {
    slide.addText(value, {
      x: X(x), y: Y(y), w: w * scale, h: h * scale,
      fontFace: FONT, fontSize: 12 * 72 * scale, margin: 0,
      color: "172B4D", fit: "shrink", valign: "middle", ...extra,
    });
  };
  const shape = (kind: NodeShape, color: string, x: number, y: number, w: number, h: number) => {
    slide.addShape(kind === "cylinder" ? pptx.ShapeType.can : pptx.ShapeType[kind], {
      x: X(x), y: Y(y), w: w * scale, h: h * scale,
      fill: { color: color.replace("#", "") }, line: { color: "64748B", width: 0.7 },
    });
  };
  const routes = tab.flows.map((flow) => ({ flow, route: flowPath(tab, flow) }));
  for (const { route } of routes) {
    for (let index = 1; index < route.points.length; index++) {
      const a = route.points[index - 1], b = route.points[index];
      slide.addShape(pptx.ShapeType.line, {
        x: X(Math.min(a.x, b.x)), y: Y(Math.min(a.y, b.y)),
        w: Math.abs(b.x - a.x) * scale, h: Math.abs(b.y - a.y) * scale,
        flipH: b.x < a.x, flipV: b.y < a.y,
        line: {
          color: "404040", width: 1,
          dashType: route.routeWarning ? "dash" : "solid",
          ...(index === route.points.length - 1 ? { endArrowType: "triangle" as const } : {}),
        },
      });
    }
  }
  for (const { flow, route } of routes) {
    const lines = flowLines(flow);
    if (route.routeWarning) lines.push(routeWarningMessage(route.routeWarning));
    text(lines.join("\n"), route.label.x - 90, route.label.y - 28, 180, 56, {
      align: "center", fontSize: 10 * 72 * scale, fill: { color: "FFFFFF" },
    });
  }
  for (const node of tab.nodes) {
    const style = nodeStyle(node);
    shape(style.shape, style.color, node.x, node.y, NODE_WIDTH, NODE_HEIGHT);
    text(nodeLines(node).join("\n"), node.x + 8, node.y + 8, NODE_WIDTH - 16, NODE_HEIGHT - 16, { align: "center" });
  }
  shape("rect", "FFFFFF", 0, 0, 460, 110);
  const m = project.meta;
  text(m.docTitle, 10, 7, 440, 27, { bold: true, fontSize: 17 * 72 * scale });
  text(`장 이름: ${tab.name}`, 10, 36, 440, 20);
  text(`버전: ${m.version}    작성일: ${m.date}`, 10, 58, 440, 20);
  text(`작성자: ${m.author || "—"}    검토자: ${m.reviewer || "—"}`, 10, 80, 440, 20);
  const legend = legendBox(tab);
  shape("roundRect", "FFFFFF", legend.x, legend.y, legend.width, legend.height);
  text("범례", legend.x + 12, legend.y + 8, legend.width - 24, 20, { bold: true });
  legendItems(tab).forEach((item, index) => {
    const x = legend.x + 12 + (index % 2) * 170;
    const y = legend.y + 38 + Math.floor(index / 2) * 30;
    shape(item.shape, item.color, x, y, 22, 16);
    text(item.label, x + 30, y, 128, 20);
  });
  text("화살표: 정보 전달 방향", legend.x + 12, legend.y + legend.height - 28, legend.width - 24, 20);
}

export async function exportPptx(project: Project, tabId: string | "all") {
  const tabs = tabId === "all" ? project.tabs : project.tabs.filter((tab) => tab.id === tabId);
  if (!tabs.length) throw new Error("내보낼 장을 찾을 수 없습니다");
  const pptx = new PptxGenJS();
  pptx.defineLayout({ name: "PRIVACYFLOW", width: 13.33, height: 7.5 });
  pptx.layout = "PRIVACYFLOW";
  pptx.author = project.meta.author;
  pptx.subject = "개인정보 처리 흐름도";
  pptx.title = project.meta.docTitle;
  pptx.theme = { headFontFace: FONT, bodyFontFace: FONT };
  for (const tab of tabs) {
    const index = project.tabs.indexOf(tab) + 1;
    diagramSlide(pptx, project, tab);
    attributeSlides(pptx, `장 ${index} — 노드 속성`, [
      ...attributes("문서", { app: project.app, schema: project.schema, activeTabId: project.activeTabId, ...project.meta }, {
        app: "앱", schema: "백업 버전", activeTabId: "활성 장 ID", docTitle: "문서명", version: "문서 버전",
        date: "작성일", author: "작성자", reviewer: "검토자",
      }),
      ...attributes("장", { id: tab.id, name: tab.name }, { id: "장 ID", name: "장 이름" }),
      ...tab.nodes.flatMap((node, i) => nodeAttributes(node, `N${String(i + 1).padStart(3, "0")}`)),
    ]);
    attributeSlides(pptx, `장 ${index} — 흐름 속성`, tab.flows.flatMap((flow, i) => {
      const reference = `F${String(i + 1).padStart(3, "0")}`;
      const nodeReference = (id: string) => {
        const at = tab.nodes.findIndex((node) => node.id === id);
        return at < 0 ? id : `N${String(at + 1).padStart(3, "0")} · ${tab.nodes[at].name}`;
      };
      return [
        ...attributes(reference, flow, flowFields),
        { reference, field: '출발 노드', value: nodeReference(flow.from) },
        { reference, field: '도착 노드', value: nodeReference(flow.to) },
      ];
    }));
  }
  attributeSlides(pptx, "변경이력", project.revisions.flatMap((revision, i) => attributes(
    `R${String(i + 1).padStart(3, "0")}`, revision,
    { id: "이력 ID", version: "버전", date: "일자", author: "작성자", desc: "변경 내용" },
  )));
  await pptx.writeFile({ fileName: fileName(project, tabId === "all" ? "전체" : tabs[0].name, "pptx") });
}
