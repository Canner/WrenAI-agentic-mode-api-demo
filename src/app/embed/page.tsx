"use client";

/**
 * Embedding demo — the PROJECT ARTIFACT library.
 *
 * This page deliberately has no chat UI. It plays the role of "some other
 * page in your product" — an internal wiki, a KPI dashboard, a customer
 * portal — that embeds deliverables an end user asked the agent to keep.
 *
 * The flow it demonstrates:
 *   1. In a chat, a user tells the agent to keep/pin a file. The agent calls
 *      `save_artifact_to_project`, the file joins the project library, and an
 *      `artifact` SSE frame announces its numeric id.
 *   2. Any page — this one — lists the library:  GET /v2/projects/{pid}/artifacts
 *   3. At RENDER TIME it mints a short-lived presigned URL per artifact:
 *        POST /v2/projects/{pid}/artifacts/{id}/presigned-url  { mode: "preview" }
 *      and points an <img>/<iframe> at it. The URL needs no API key and no
 *      session — safe to hand to a browser — but it EXPIRES in minutes, so
 *      mint on render, never store it.
 *
 * Contrast with the chat app itself, which reads thread-workspace files by
 * filename (no minting, bytes in one request). Workspace = working files of
 * one conversation; library = curated deliverables for the whole project.
 */

import { useCallback, useEffect, useState } from "react";
import type { ArtifactMeta } from "@/lib/types";
import { getArtifactUrl } from "@/lib/client";

function EmbeddedArtifact({ artifact }: { artifact: ArtifactMeta }) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Mint the presigned preview URL when the card renders.
  useEffect(() => {
    getArtifactUrl(artifact.id, "preview")
      .then((d) => setUrl(d.url))
      .catch((e) => setError((e as Error).message));
  }, [artifact.id]);

  const isImage = (artifact.contentType || "").startsWith("image/");

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-800">{artifact.name}</h2>
          {artifact.description && <p className="text-xs text-slate-500">{artifact.description}</p>}
        </div>
        <button
          className="rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
          onClick={async () => {
            try {
              const { url } = await getArtifactUrl(artifact.id, "download");
              window.open(url, "_blank");
            } catch (e) {
              alert((e as Error).message);
            }
          }}
        >
          Download
        </button>
      </div>
      <div className="h-96 bg-slate-50">
        {error && <div className="p-6 text-sm text-red-700">{error}</div>}
        {!url && !error && <div className="p-6 text-sm text-slate-400">Minting preview URL…</div>}
        {url && (isImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt={artifact.name} className="mx-auto max-h-full p-4" />
        ) : (
          <iframe src={url} className="h-full w-full border-0 bg-white" title={artifact.name} sandbox="allow-scripts allow-same-origin" />
        ))}
      </div>
    </section>
  );
}

export default function EmbedGallery() {
  const [artifacts, setArtifacts] = useState<ArtifactMeta[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch("/api/artifacts");
      if (!res.ok) throw new Error(`Failed to load the artifact library (${res.status})`);
      const d = await res.json();
      setArtifacts(d.artifacts || []);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-4">
          <div>
            <h1 className="text-lg font-semibold text-slate-900">Q3 Insights Portal</h1>
            <p className="text-xs text-slate-500">
              A pretend host page embedding the project&apos;s <strong>kept</strong> artifacts via presigned URLs — no API key in the browser.
            </p>
          </div>
          <a className="text-sm text-sky-700 hover:underline" href="/">← Back to chat</a>
        </div>
      </header>

      <main className="mx-auto max-w-4xl space-y-6 px-6 py-8">
        {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>}
        {artifacts === null && !error && <div className="text-sm text-slate-400">Loading library…</div>}

        {artifacts && artifacts.length === 0 && (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-400">
            The project library is empty. In a chat, ask the agent to make something, then say
            <em> &quot;keep this&quot;</em> — the artifact will appear here.
          </div>
        )}

        {artifacts?.map((a) => <EmbeddedArtifact key={a.id} artifact={a} />)}

        <p className="text-center text-xs text-slate-400">
          Each panel above minted a fresh presigned preview URL when it rendered — the URLs expire in minutes, so they are never stored.
        </p>
      </main>
    </div>
  );
}
