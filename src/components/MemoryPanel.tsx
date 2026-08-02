"use client";

import { useCallback, useEffect, useState } from "react";
import Markdown from "./Markdown";

interface MemoryData {
  namespace: string;
  content: string | null;
  files: string[];
}

export default function MemoryPanel({ namespace }: { namespace: string }) {
  const [data, setData] = useState<MemoryData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [wiping, setWiping] = useState(false);
  const [fileView, setFileView] = useState<{ path: string; content: string } | null>(null);

  const refresh = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch(`/api/memory?ns=${encodeURIComponent(namespace)}`);
      if (!res.ok) throw new Error(`Failed to load memory (${res.status})`);
      setData(await res.json());
    } catch (e) {
      setError((e as Error).message);
    }
  }, [namespace]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const wipe = async () => {
    if (!confirm(`Wipe all memory in namespace "${namespace}"? This cannot be undone.`)) return;
    setWiping(true);
    try {
      const res = await fetch(`/api/memory?ns=${encodeURIComponent(namespace)}`, { method: "DELETE" });
      if (!res.ok) throw new Error(`Wipe failed (${res.status})`);
      setFileView(null);
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setWiping(false);
    }
  };

  const openFile = async (path: string) => {
    try {
      const res = await fetch(`/api/memory?ns=${encodeURIComponent(namespace)}&path=${encodeURIComponent(path)}`);
      if (!res.ok) throw new Error(`Failed to read ${path} (${res.status})`);
      const d = await res.json();
      setFileView({ path, content: d.content ?? "" });
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const empty = !data?.content && (data?.files?.length ?? 0) === 0;

  return (
    <div className="h-full overflow-y-auto bg-slate-50 p-6">
      <div className="mx-auto max-w-3xl space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">Agent memory</h1>
            <p className="text-sm text-slate-500">
              Namespace <span className="font-mono">{namespace}</span> — the agent saves memories here when you chat.
            </p>
          </div>
          <button
            className="rounded-lg border border-red-200 bg-white px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
            onClick={wipe}
            disabled={wiping || !data || empty}
          >
            {wiping ? "Wiping…" : "Wipe memory"}
          </button>
        </div>

        {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>}
        {!data && !error && <div className="text-sm text-slate-400">Loading…</div>}

        {data && empty && (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-400">
            No memory yet. Try asking the agent to “remember that I prefer concise answers”, then come back here.
          </div>
        )}

        {data?.content && (
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-400">MEMORY.md</div>
            <Markdown>{data.content}</Markdown>
          </div>
        )}

        {data && data.files.length > 0 && (
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-400">Memory files</div>
            <ul className="space-y-1">
              {data.files.map((f) => (
                <li key={f}>
                  <button className="font-mono text-sm text-sky-700 hover:underline" onClick={() => openFile(f)}>
                    {f}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {fileView && (
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="mb-2 flex items-center justify-between">
              <div className="font-mono text-xs text-slate-500">{fileView.path}</div>
              <button className="text-xs text-slate-400 hover:text-slate-700" onClick={() => setFileView(null)}>
                Close ✕
              </button>
            </div>
            <pre className="max-h-96 overflow-auto whitespace-pre-wrap text-sm text-slate-700">{fileView.content}</pre>
          </div>
        )}
      </div>
    </div>
  );
}
