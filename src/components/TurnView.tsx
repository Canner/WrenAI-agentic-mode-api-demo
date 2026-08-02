"use client";

import { useState } from "react";
import type { Block, TodoItem, Turn } from "@/lib/types";
import { formatBytes, getArtifactUrl, previewKind } from "@/lib/client";
import type { ExportPreviewTarget } from "./PreviewPanel";
import Markdown from "./Markdown";
import EChart from "./EChart";

function Spinner() {
  return <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600 align-middle" />;
}

function ThinkingBlock({ block }: { block: Extract<Block, { kind: "thinking" }> }) {
  return (
    <details className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm" open={!block.done}>
      <summary className="cursor-pointer select-none font-medium text-slate-500">
        {block.done ? "Thought process" : <>Thinking… <Spinner /></>}
      </summary>
      <div className="mt-2 whitespace-pre-wrap text-slate-400">{block.content}</div>
    </details>
  );
}

function ToolBlock({ block }: { block: Extract<Block, { kind: "tool" }> }) {
  return (
    <details className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm">
      <summary className="cursor-pointer select-none text-amber-800">
        <span className="font-mono font-medium">{block.name}</span>{" "}
        {block.done ? <span className="text-emerald-600">✓</span> : <Spinner />}
        {block.summary && (
          <span className="ml-2 inline-block max-w-[70%] truncate align-bottom font-mono text-xs text-amber-600" title={block.summary}>
            {block.summary}
          </span>
        )}
      </summary>
      {block.input && (
        <div className="mt-2">
          <div className="text-[10px] font-medium uppercase tracking-wide text-amber-500">Input</div>
          <pre className="mt-1 max-h-48 overflow-auto whitespace-pre-wrap text-xs text-amber-900">{block.input}</pre>
        </div>
      )}
      {block.output && (
        <div className="mt-2">
          <div className="text-[10px] font-medium uppercase tracking-wide text-amber-500">Output</div>
          <pre className="mt-1 max-h-48 overflow-auto whitespace-pre-wrap text-xs text-amber-900">{block.output}</pre>
        </div>
      )}
    </details>
  );
}

function SubagentBlock({ block }: { block: Extract<Block, { kind: "subagent" }> }) {
  return (
    <details className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm">
      <summary className="cursor-pointer select-none text-indigo-800">
        <span className="font-medium">Subagent:</span> {block.name}{" "}
        {block.done ? <span className="text-emerald-600">✓</span> : <Spinner />}
      </summary>
      <ul className="mt-2 max-h-64 space-y-1 overflow-auto text-xs text-indigo-900">
        {block.events.map((e, i) => (
          <li key={i} className="whitespace-pre-wrap font-mono">{e}</li>
        ))}
      </ul>
    </details>
  );
}

// One card for both artifact tiers:
// - a promoted PROJECT artifact (has artifactId) previews/downloads via the
//   presigned-url endpoint;
// - a thread WORKSPACE file (no artifactId) is fetched by filename via the
//   workspace endpoint.
export function ArtifactCard({
  artifactId,
  threadId,
  name,
  kind,
  description,
  onPreview,
  onPreviewWorkspace,
}: {
  artifactId?: number;
  threadId?: number | null;
  name: string;
  kind: string;
  description?: string;
  onPreview: (id: number, name: string) => void;
  onPreviewWorkspace: (target: ExportPreviewTarget) => void;
}) {
  const [busy, setBusy] = useState(false);
  const hasProjectArtifact = artifactId !== undefined && Number.isFinite(artifactId);
  const workspaceUrl = threadId ? `/api/threads/${threadId}/workspace/${encodeURIComponent(name)}` : undefined;
  const workspacePreview = workspaceUrl ? previewKind(name, kind) : null;
  const download = async () => {
    setBusy(true);
    try {
      const { url } = await getArtifactUrl(artifactId!, "download");
      window.open(url, "_blank");
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="flex items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm">
      <span className="text-lg">📄</span>
      <div className="min-w-0 flex-1">
        <div className="truncate font-medium text-emerald-900">{name}</div>
        <div className="text-xs text-emerald-700">{kind}</div>
        {description && <div className="mt-0.5 line-clamp-1 text-xs text-emerald-600">{description}</div>}
      </div>
      {hasProjectArtifact ? (
        <>
          <button className="rounded-md border border-emerald-300 bg-white px-2 py-1 text-xs font-medium text-emerald-800 hover:bg-emerald-100 disabled:opacity-50" disabled={busy} onClick={() => onPreview(artifactId!, name)}>
            Preview
          </button>
          <button className="rounded-md border border-emerald-300 bg-white px-2 py-1 text-xs font-medium text-emerald-800 hover:bg-emerald-100 disabled:opacity-50" disabled={busy} onClick={download}>
            Download
          </button>
        </>
      ) : (
        <>
          {workspacePreview && (
            <button
              className="rounded-md border border-emerald-300 bg-white px-2 py-1 text-xs font-medium text-emerald-800 hover:bg-emerald-100"
              onClick={() => onPreviewWorkspace({ filename: name, contentType: kind, kind: workspacePreview, localUrl: workspaceUrl })}
            >
              Preview
            </button>
          )}
          {workspaceUrl ? (
            <a
              className="rounded-md border border-emerald-300 bg-white px-2 py-1 text-xs font-medium text-emerald-800 hover:bg-emerald-100"
              href={`${workspaceUrl}?mode=download`}
              target="_blank"
              rel="noreferrer"
            >
              Download
            </a>
          ) : (
            <span className="text-xs text-emerald-600">saved in thread workspace</span>
          )}
        </>
      )}
    </div>
  );
}

function ExportCard({ block, onPreview }: { block: Extract<Block, { kind: "export" }>; onPreview: (target: ExportPreviewTarget) => void }) {
  const kind = previewKind(block.filename, block.contentType);
  return (
    <div className="flex items-center gap-3 rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-sm">
      <span className="text-lg">⬇️</span>
      <div className="min-w-0 flex-1">
        <div className="truncate font-medium text-violet-900">{block.filename}</div>
        <div className="text-xs text-violet-700">
          {block.contentType || "file"}
          {block.sizeBytes !== undefined ? ` · ${formatBytes(block.sizeBytes)}` : ""}
        </div>
        {block.description && <div className="mt-0.5 line-clamp-1 text-xs text-violet-600">{block.description}</div>}
      </div>
      {kind && (
        <button
          className="rounded-md border border-violet-300 bg-white px-2 py-1 text-xs font-medium text-violet-800 hover:bg-violet-100"
          onClick={() =>
            onPreview({ filename: block.filename, downloadUrl: block.downloadUrl, contentType: block.contentType, sizeBytes: block.sizeBytes, kind })
          }
        >
          Preview
        </button>
      )}
      <a
        className="rounded-md border border-violet-300 bg-white px-2 py-1 text-xs font-medium text-violet-800 hover:bg-violet-100"
        href={block.downloadUrl}
        target="_blank"
        rel="noreferrer"
      >
        Download
      </a>
    </div>
  );
}

export function TodoList({ items, streaming }: { items: TodoItem[]; streaming: boolean }) {
  const done = items.filter((t) => t.status === "completed").length;
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wide text-slate-400">Plan</span>
        <span className="text-xs text-slate-400">
          {done}/{items.length} done
        </span>
      </div>
      <ul className="mt-1.5 space-y-1">
        {items.map((t, i) => (
          <li key={i} className="flex items-start gap-2">
            {t.status === "completed" ? (
              <span className="mt-0.5 text-emerald-600">✓</span>
            ) : t.status === "in_progress" ? (
              streaming ? <span className="mt-1"><Spinner /></span> : <span className="mt-0.5 text-sky-600">▸</span>
            ) : (
              <span className="mt-0.5 text-slate-300">○</span>
            )}
            <span className={t.status === "completed" ? "text-slate-400 line-through" : t.status === "in_progress" ? "font-medium text-slate-800" : "text-slate-500"}>
              {t.status === "in_progress" && streaming && t.activeForm ? t.activeForm : t.content}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function QuestionBlock({ block, onAnswer }: { block: Extract<Block, { kind: "question" }>; onAnswer: (block: Extract<Block, { kind: "question" }>, answer: string) => void | Promise<void> }) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);

  // Guard against double-submits: user_input takes a couple of seconds and a
  // repeated answer for the same questionId is rejected with 404.
  const submitAnswer = async (answer: string) => {
    if (sending) return;
    setSending(true);
    try {
      await onAnswer(block, answer);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-sm">
      <div className="font-medium text-sky-900">The agent asks:</div>
      <div className="mt-1 whitespace-pre-wrap text-sky-800">{block.text}</div>
      {block.answered ? (
        <div className="mt-2 text-xs text-sky-600">Answer sent ✓</div>
      ) : (
        <div className="mt-2 space-y-2">
          {block.options.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {block.options.map((opt) => (
                <button key={opt} className="rounded-md border border-sky-300 bg-white px-2 py-1 text-xs hover:bg-sky-100 disabled:opacity-50" disabled={sending} onClick={() => submitAnswer(opt)}>
                  {opt}
                </button>
              ))}
            </div>
          )}
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (text.trim()) submitAnswer(text.trim());
            }}
          >
            <input className="flex-1 rounded-md border border-sky-300 bg-white px-2 py-1 text-sm outline-none focus:border-sky-500 disabled:opacity-50" placeholder="Type a reply…" value={text} disabled={sending} onChange={(e) => setText(e.target.value)} />
            <button className="rounded-md bg-sky-600 px-3 py-1 text-xs font-medium text-white hover:bg-sky-700 disabled:opacity-50" type="submit" disabled={sending}>
              {sending ? "Sending…" : "Send"}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

export default function TurnView({
  turn,
  threadId,
  onAnswer,
  onPreviewArtifact,
  onPreviewExport,
}: {
  turn: Turn;
  threadId?: number | null;
  onAnswer: (block: Extract<Block, { kind: "question" }>, answer: string) => void | Promise<void>;
  onPreviewArtifact: (id: number, name: string) => void;
  onPreviewExport: (target: ExportPreviewTarget) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <div className="max-w-[80%] rounded-2xl rounded-br-sm bg-slate-900 px-4 py-2 text-sm text-white">
          <div className="whitespace-pre-wrap">{turn.question}</div>
          {turn.files && turn.files.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {turn.files.map((f) => (
                <span key={f.filePath} className="rounded-full bg-slate-700 px-2 py-0.5 text-xs">📎 {f.fileName}</span>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="space-y-2">
        {turn.blocks.map((block) => {
          switch (block.kind) {
            case "thinking":
              return <ThinkingBlock key={block.blockId} block={block} />;
            case "answer":
              return (
                <div key={block.blockId} className="rounded-2xl rounded-bl-sm border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm">
                  <Markdown>{block.content}</Markdown>
                </div>
              );
            case "tool":
              return <ToolBlock key={block.blockId} block={block} />;
            case "chart":
              return (
                <div key={block.blockId} className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
                  <EChart option={block.spec} />
                  {block.caption && <div className="mt-1 px-1 text-xs text-slate-500">{block.caption}</div>}
                </div>
              );
            case "subagent":
              return <SubagentBlock key={block.blockId} block={block} />;
            case "artifact":
              return (
                <ArtifactCard
                  key={block.blockId}
                  artifactId={block.artifactId}
                  threadId={threadId}
                  name={block.name}
                  kind={block.artifactKind}
                  description={block.description}
                  onPreview={onPreviewArtifact}
                  onPreviewWorkspace={onPreviewExport}
                />
              );
            case "export":
              return <ExportCard key={block.blockId} block={block} onPreview={onPreviewExport} />;
            case "todos":
              // While streaming, the plan is shown pinned at the top of the
              // chat (see Chat.tsx); render it inline once the turn settles.
              return turn.status === "streaming" ? null : <TodoList key={block.blockId} items={block.items} streaming={false} />;
            case "question":
              return <QuestionBlock key={block.blockId} block={block} onAnswer={onAnswer} />;
            case "error":
              return (
                <div key={block.blockId} className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
                  {block.message}
                </div>
              );
          }
        })}
        {turn.status === "streaming" && turn.blocks.length === 0 && (
          <div className="flex items-center gap-2 text-sm text-slate-400">
            <Spinner /> Starting turn…
          </div>
        )}
        {turn.status === "interrupted" && <div className="text-xs italic text-slate-400">Turn cancelled.</div>}
      </div>
    </div>
  );
}
