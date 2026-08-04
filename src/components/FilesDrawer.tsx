"use client";

import { useEffect, useState } from "react";
import type { WorkspaceFile } from "@/lib/types";
import { previewKind } from "@/lib/client";
import type { ExportPreviewTarget } from "./PreviewPanel";

// Slide-over listing ONE conversation's workspace files — everything
// `create_artifact` produced in this thread. Opened from the chat header, so
// the thread scope is self-evident. Files are addressed by filename:
//   GET /v2/projects/{pid}/threads/{tid}/workspace              (this list)
//   GET /v2/projects/{pid}/threads/{tid}/workspace/{filename}   (the bytes)
export default function FilesDrawer({
  threadId,
  files,
  onRefresh,
  onPreview,
  onClose,
}: {
  threadId: number;
  files: WorkspaceFile[] | null;
  onRefresh: () => void;
  onPreview: (target: ExportPreviewTarget) => void;
  onClose: () => void;
}) {
  const [open, setOpen] = useState(false);

  // Mount closed, then slide in on the next frame.
  useEffect(() => {
    const t = requestAnimationFrame(() => setOpen(true));
    return () => cancelAnimationFrame(t);
  }, []);

  const close = () => {
    setOpen(false);
    setTimeout(onClose, 200);
  };

  return (
    // z-40: the file PreviewPanel (z-50) stacks on top of this drawer.
    <div className="fixed inset-0 z-40">
      <div className={`absolute inset-0 bg-black/20 transition-opacity duration-200 ${open ? "opacity-100" : "opacity-0"}`} onClick={close} />
      <div
        className={`absolute inset-y-0 right-0 flex w-full max-w-md flex-col bg-white shadow-2xl transition-transform duration-200 ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <div>
            <div className="text-sm font-semibold text-slate-800">Files in this conversation</div>
            <div className="text-xs text-slate-400">Workspace of thread {threadId}</div>
          </div>
          <div className="flex items-center gap-2">
            <button className="rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50" onClick={onRefresh}>
              Refresh
            </button>
            <button className="rounded-md px-2 py-1 text-slate-400 hover:text-slate-700" onClick={close}>
              ✕
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          {files === null && (
            <div className="p-4 text-sm text-slate-400">
              Couldn&apos;t list this thread&apos;s workspace — the deployment may not support listing yet. Files still appear as cards in the chat.
            </div>
          )}
          {files && files.length === 0 && (
            <div className="p-4 text-sm text-slate-400">No files yet. Ask the agent to create a report or summary.</div>
          )}
          {files && files.length > 0 && (
            <ul className="space-y-2">
              {files.map((f) => {
                const kind = previewKind(f.filename, f.contentType);
                const url = `/api/threads/${threadId}/workspace/${encodeURIComponent(f.filename)}`;
                return (
                  <li key={f.filename} className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2">
                    <span>📄</span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium text-slate-800">{f.filename}</div>
                      <div className="text-xs text-slate-400">
                        {(f.contentType || "unknown type").split(";")[0]}
                        {f.lastModified ? ` · ${new Date(f.lastModified).toLocaleString()}` : ""}
                      </div>
                    </div>
                    {kind && (
                      <button
                        className="rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                        onClick={() => onPreview({ filename: f.filename, contentType: f.contentType || "", kind, localUrl: url })}
                      >
                        Preview
                      </button>
                    )}
                    <a className="rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50" href={`${url}?mode=download`} target="_blank" rel="noreferrer">
                      Download
                    </a>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
