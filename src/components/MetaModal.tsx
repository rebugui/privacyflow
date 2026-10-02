import { useState } from "react";
import { Modal } from "./Modal";
import {
  useProjectStore,
  today,
  uid,
  projectSnapshot,
} from "../store/useProjectStore";
import { useUiStore } from "../store/useUiStore";
export function MetaModal({ onClose }: { onClose: () => void }) {
  const s = useProjectStore(),
    notify = useUiStore((s) => s.notify);
  const [meta, setMeta] = useState({ ...s.meta }),
    [revisions, setRevisions] = useState(s.revisions.map((r) => ({ ...r })));
  return (
    <Modal title="문서 정보 · 변경이력" onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          s.replaceProject({ ...projectSnapshot(), meta, revisions });
          notify("문서 정보를 적용했습니다");
          onClose();
        }}
      >
        <div className="meta-grid">
          {(
            [
              ["docTitle", "문서명"],
              ["version", "버전"],
              ["date", "작성일"],
              ["author", "작성자"],
              ["reviewer", "검토자"],
            ] as const
          ).map(([key, label]) => (
            <label key={key}>
              {label}
              <input
                type={key === "date" ? "date" : "text"}
                required={key === "docTitle"}
                value={meta[key]}
                onChange={(e) => setMeta({ ...meta, [key]: e.target.value })}
              />
            </label>
          ))}
        </div>
        <div className="modal-actions">
          <h3>변경이력</h3>
          <button
            type="button"
            onClick={() =>
              setRevisions([
                ...revisions,
                {
                  id: uid(),
                  version: meta.version,
                  date: today(),
                  author: meta.author,
                  desc: "",
                },
              ])
            }
          >
            이력 추가
          </button>
        </div>
        <p className="muted">
          PPTX의 마지막 슬라이드에 변경이력 표가 포함됩니다.
        </p>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>버전</th>
                <th>일자</th>
                <th>작성자</th>
                <th>변경 내용</th>
                <th>삭제</th>
              </tr>
            </thead>
            <tbody>
              {revisions.map((r) => (
                <tr key={r.id}>
                  {(["version", "date", "author", "desc"] as const).map(
                    (key) => (
                      <td key={key}>
                        <input
                          aria-label={`이력 ${key}`}
                          type={key === "date" ? "date" : "text"}
                          value={r[key]}
                          onChange={(e) =>
                            setRevisions(
                              revisions.map((item) =>
                                item.id === r.id
                                  ? { ...item, [key]: e.target.value }
                                  : item,
                              ),
                            )
                          }
                        />
                      </td>
                    ),
                  )}
                  <td>
                    <button
                      type="button"
                      aria-label="이력 삭제"
                      onClick={() =>
                        setRevisions(
                          revisions.filter((item) => item.id !== r.id),
                        )
                      }
                    >
                      ×
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="modal-actions">
          <span />
          <button className="primary">문서 정보 적용</button>
        </div>
      </form>
    </Modal>
  );
}
