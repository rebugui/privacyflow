import type { Node, NodeProps } from "@xyflow/react";
import type { ProjectMeta } from "../../types";
export function TitleBlockNode({
  data,
}: NodeProps<Node<{ meta: ProjectMeta; tabName: string }>>) {
  const m = data.meta;
  return (
    <div className="title-block">
      <div className="title-heading">{m.docTitle}</div>
      <table>
        <tbody>
          <tr>
            <th>장 이름</th>
            <td colSpan={3}>{data.tabName}</td>
          </tr>
          <tr>
            <th>버전</th>
            <td>{m.version}</td>
            <th>작성일</th>
            <td>{m.date}</td>
          </tr>
          <tr>
            <th>작성자</th>
            <td>{m.author || "—"}</td>
            <th>검토자</th>
            <td>{m.reviewer || "—"}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
