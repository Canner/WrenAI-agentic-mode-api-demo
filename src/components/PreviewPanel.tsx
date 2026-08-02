"use client";

import { useEffect, useState } from "react";
import { formatBytes, type PreviewKind } from "@/lib/client";
import Markdown from "./Markdown";

export interface ExportPreviewTarget {
  filename: string;
  contentType: string;
  sizeBytes?: number;
  kind: PreviewKind;
  // Exactly one of these is set:
  // - downloadUrl: a signed URL from an export tool (export_file/export_text)
  // - localUrl: a same-origin URL served by our workspace proxy route
  downloadUrl?: string;
  localUrl?: string;
}

// Slide-over panel that previews files the agent produced (markdown / html /
// pdf). Workspace files come through our same-origin proxy; export files come
// through /api/proxy-file because their signed URLs force an attachment
// disposition and lack CORS headers, so the browser cannot render them
// directly.
export default function PreviewPanel({ target, onClose }: { target: ExportPreviewTarget; onClose: () => void }) {
  const [open, setOpen] = useState(false);
  const [markdown, setMarkdown] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const src = target.localUrl ?? (target.downloadUrl ? `/api/proxy-file?url=${encodeURIComponent(target.downloadUrl)}` : null);
  const downloadHref = target.downloadUrl ?? (target.localUrl ? `${target.localUrl}?mode=download` : undefined);

  // Mount closed, then slide in on the next frame.
  useEffect(() => {
    const t = requestAnimationFrame(() => setOpen(true));
    return () => cancelAnimationFrame(t);
  }, []);

  // Markdown is fetched as text and rendered ourselves; html/pdf go in an iframe.
  useEffect(() => {
    setMarkdown(null);
    setError(null);
    if (target.kind !== "markdown" || !src) return;
    fetch(src)
      .then((r) => {
        if (!r.ok) throw new Error(`Failed to load file (${r.status})`);
        return r.text();
      })
      .then(setMarkdown)
      .catch((e) => setError((e as Error).message));
  }, [src, target.kind]);

  const close = () => {
    setOpen(false);
    setTimeout(onClose, 200); // let the slide-out transition finish
  };

  return (
    <div className="fixed inset-0 z-50">
      <div className={`absolute inset-0 bg-black/30 transition-opacity duration-200 ${open ? "opacity-100" : "opacity-0"}`} onClick={close} />
      <div
        className={`absolute inset-y-0 right-0 flex w-full max-w-2xl flex-col bg-white shadow-2xl transition-transform duration-200 ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <div className="min-w-0">
            <div className="truncate text-sm font-medium text-slate-800">{target.filename}</div>
            <div className="text-xs text-slate-400">
              {target.contentType || target.kind}
              {target.sizeBytes !== undefined ? ` · ${formatBytes(target.sizeBytes)}` : ""}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {downloadHref && (
              <a
                className="rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                href={downloadHref}
                target="_blank"
                rel="noreferrer"
              >
                Download
              </a>
            )}
            <button className="rounded-md px-2 py-1 text-slate-400 hover:text-slate-700" onClick={close}>
              ✕
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-auto bg-slate-50">
          {error && <div className="p-6 text-sm text-red-700">{error}</div>}
          {target.kind === "markdown" &&
            (markdown === null && !error ? (
              <div className="p-6 text-sm text-slate-400">Loading…</div>
            ) : (
              <div className="mx-auto max-w-2xl bg-white p-6 shadow-sm">
                <Markdown>{markdown ?? ""}</Markdown>
              </div>
            ))}
          {target.kind === "html" && src && (
            <iframe src={src} className="h-full w-full border-0 bg-white" title={target.filename} sandbox="allow-scripts" />
          )}
          {target.kind === "pdf" && src && <iframe src={src} className="h-full w-full border-0" title={target.filename} />}
        </div>
      </div>
    </div>
  );
}
