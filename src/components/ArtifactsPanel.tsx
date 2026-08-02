"use client";

import { useCallback, useEffect, useState } from "react";
import type { ArtifactMeta } from "@/lib/types";
import { getArtifactUrl } from "@/lib/client";

export interface PreviewTarget {
  id: number;
  name: string;
}

export function ArtifactPreviewModal({ target, onClose }: { target: PreviewTarget; onClose: () => void }) {
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

export default function ArtifactsPanel({ onPreview }: { onPreview: (id: number, name: string) => void }) {
  const [artifacts, setArtifacts] = useState<ArtifactMeta[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch("/api/artifacts");
      if (!res.ok) throw new Error(`Failed to load artifacts (${res.status})`);
      const d = await res.json();
      setArtifacts(d.artifacts || []);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const download = async (id: number) => {
    try {
      const { url } = await getArtifactUrl(id, "download");
      window.open(url, "_blank");
    } catch (e) {
      alert((e as Error).message);
    }
  };

  return (
    <div className="h-full overflow-y-auto bg-slate-50 p-6">
      <div className="mx-auto max-w-3xl space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">Artifacts</h1>
            <p className="text-sm text-slate-500">Files the agent produced — charts, reports, exports.</p>
          </div>
          <button className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-100" onClick={refresh}>
            Refresh
          </button>
        </div>

        {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>}
        {artifacts === null && !error && <div className="text-sm text-slate-400">Loading…</div>}

        {artifacts && artifacts.length === 0 && (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-400">
            No artifacts yet. Ask the agent to create a chart or a report and it will show up here.
          </div>
        )}

        {artifacts && artifacts.length > 0 && (
          <ul className="space-y-2">
            {artifacts.map((a) => (
              <li key={a.id} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3">
                <span className="text-xl">📄</span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-slate-800">{a.name}</div>
                  <div className="text-xs text-slate-500">
                    {a.kind} · {a.contentType || "unknown type"}
                    {a.updatedAt ? ` · updated ${new Date(a.updatedAt).toLocaleString()}` : ""}
                  </div>
                  {a.description && <div className="mt-0.5 line-clamp-1 text-xs text-slate-400">{a.description}</div>}
                </div>
                <button className="rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50" onClick={() => onPreview(a.id, a.name)}>
                  Preview
                </button>
                <button className="rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50" onClick={() => download(a.id)}>
                  Download
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
