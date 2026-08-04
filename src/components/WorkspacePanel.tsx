"use client";

import { useCallback, useEffect, useState } from "react";
import { previewKind } from "@/lib/client";
import type { ExportPreviewTarget } from "./PreviewPanel";

interface WorkspaceFile {
  filename: string;
  contentType?: string;
  lastModified?: string;
}

// Lists the ACTIVE thread's workspace files — everything `create_artifact`
// produced in that conversation. Files are addressed by filename and fetched
// through GET /v2/projects/{pid}/threads/{tid}/workspace/{filename}; there is
// no URL-minting step (the response body IS the file).
export default function WorkspacePanel({
  threadId,
  onPreview,
}: {
  threadId: number | null;
  onPreview: (target: ExportPreviewTarget) => void;
}) {
  const [files, setFiles] = useState<WorkspaceFile[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setError(null);
    setFiles(null);
    if (threadId === null) return;
    try {
      const res = await fetch(`/api/threads/${threadId}/workspace`);
      const data = await res.json().catch(() => null);
      if (!res.ok || !data || !Array.isArray(data.files)) {
        throw new Error(data?.error || "Workspace listing is not available on this deployment yet.");
      }
      setFiles(data.files);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [threadId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <div className="h-full overflow-y-auto bg-slate-50 p-6">
      <div className="mx-auto max-w-3xl space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">Thread files</h1>
            <p className="text-sm text-slate-500">
              Workspace files the agent created in the current conversation{threadId !== null ? ` (thread ${threadId})` : ""}.
            </p>
          </div>
          {threadId !== null && (
            <button className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-100" onClick={refresh}>
              Refresh
            </button>
          )}
        </div>

        {threadId === null && (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-400">
            Open a chat first — each thread has its own workspace.
          </div>
        )}

        {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>}
        {threadId !== null && files === null && !error && <div className="text-sm text-slate-400">Loading…</div>}

        {files && files.length === 0 && (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-400">
            No files yet. Ask the agent to create a report or summary and it will show up here.
          </div>
        )}

        {files && files.length > 0 && (
          <ul className="space-y-2">
            {files.map((f) => {
              const kind = previewKind(f.filename, f.contentType);
              const url = `/api/threads/${threadId}/workspace/${encodeURIComponent(f.filename)}`;
              return (
                <li key={f.filename} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3">
                  <span className="text-xl">📄</span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-slate-800">{f.filename}</div>
                    <div className="text-xs text-slate-500">
                      {f.contentType || "unknown type"}
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
  );
}
