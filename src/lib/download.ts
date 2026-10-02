import type { Project } from "../types";
export function fileName(project: Project, tabName: string, extension: string) {
  const now = new Date();
  const date = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
  return `PrivacyFlow_${project.meta.docTitle}_${tabName}_${date}.${extension}`.replace(
    /[\\/:*?"<>|]/g,
    "_",
  );
}
export function download(data: Blob | string, name: string) {
  const url = typeof data === "string" ? data : URL.createObjectURL(data);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  if (typeof data !== "string")
    setTimeout(() => URL.revokeObjectURL(url), 5000);
}
