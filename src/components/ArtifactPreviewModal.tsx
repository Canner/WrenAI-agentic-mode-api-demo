"use client";

import { useEffect, useState } from "react";
import { getArtifactUrl } from "@/lib/client";

export interface PreviewTarget {
  id: number;
  name: string;
}

// Preview modal for PROMOTED project artifacts (the ones announced by an
// `artifact` SSE frame). The bytes live in object storage behind a
// short-lived presigned URL, minted at view time — never store these URLs,
// they expire in minutes.
export default function ArtifactPreviewModal({ target, onClose }: { target: PreviewTarget; onClose: () => void }) {
  const [url, setUrl] = useState<string | null>(null);
  const [contentType, setContentType] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setUrl(null);
    setError(null);
    getArtifactUrl(target.id, "preview")
      .then((d) => {
        setUrl(d.url);
        setContentType(d.contentType || "");
      })
      .catch((e) => setError((e as Error).message));
  }, [target]);

  const isImage = contentType.startsWith("image/");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-6" onClick={onClose}>
      <div className="flex h-[85vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <div className="truncate text-sm font-medium text-slate-800">{target.name}</div>
          <div className="flex items-center gap-3">
            <button
              className="rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
              onClick={async () => {
                try {
                  const { url } = await getArtifactUrl(target.id, "download");
                  window.open(url, "_blank");
                } catch (e) {
                  alert((e as Error).message);
                }
              }}
            >
              Download
            </button>
            <button className="text-slate-400 hover:text-slate-700" onClick={onClose}>✕</button>
          </div>
        </div>
        <div className="flex-1 overflow-auto bg-slate-100">
          {error && <div className="p-6 text-sm text-red-700">{error}</div>}
          {!url && !error && <div className="p-6 text-sm text-slate-400">Loading preview…</div>}
          {url && (isImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={url} alt={target.name} className="mx-auto max-w-full p-4" />
          ) : (
            <iframe src={url} className="h-full w-full border-0 bg-white" title={target.name} sandbox="allow-scripts allow-same-origin" />
          ))}
        </div>
      </div>
    </div>
  );
}
