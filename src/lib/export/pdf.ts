import { jsPDF } from "jspdf";
import type { Project } from "../../types";
import { captureTab } from "./image";
import { fileName } from "../download";
export async function exportPdf(project: Project) {
  const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a3" });
  for (const [i, tab] of project.tabs.entries()) {
    if (i) pdf.addPage("a3", "landscape");
    const { data, width, height } = await captureTab(project, tab);
    const scale = Math.min(400 / width, 277 / height),
      w = width * scale,
      h = height * scale;
    pdf.addImage(
      data,
      "PNG",
      (420 - w) / 2,
      (297 - h) / 2,
      w,
      h,
      undefined,
      "FAST",
    );
  }
  pdf.save(fileName(project, "전체", "pdf"));
}
