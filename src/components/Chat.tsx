"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Block, ThreadMessage, Turn, TurnEvent, UploadedFile } from "@/lib/types";
import { reduceTurn } from "@/lib/turnReducer";
import { streamSse } from "@/lib/sse";
import Composer from "./Composer";
import TurnView, { TodoList } from "./TurnView";
import type { ExportPreviewTarget } from "./PreviewPanel";

type QuestionBlockT = Extract<Block, { kind: "question" }>;

// Remounted (via key) only on explicit navigation: a live turn that receives
// its threadId from the `init` frame must keep streaming uninterrupted.
export default function Chat({
  initialThreadId,
  memoryNamespace,
  onThreadCreated,
  onThreadActivity,
  onPreviewArtifact,
  onPreviewExport,
}: {
  initialThreadId: number | null;
  memoryNamespace: string;
  onThreadCreated: (threadId: number, title: string) => void;
  onThreadActivity: (threadId: number) => void;
  onPreviewArtifact: (id: number, name: string) => void;
  onPreviewExport: (target: ExportPreviewTarget) => void;
}) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);
  // Mirrors liveThreadId for rendering (workspace-file links need it).
  const [threadId, setThreadId] = useState<number | null>(initialThreadId);
  const liveResponseId = useRef<number | null>(null);
  const liveThreadId = useRef<number | null>(initialThreadId);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Rebuild past turns by replaying each turn's persisted events through the
  // same reducer used for live streaming.
  useEffect(() => {
    const threadId = initialThreadId;
    setTurns([]);
    setBanner(null);
    if (threadId === null) return;
    let cancelled = false;
    (async () => {
      setLoadingHistory(true);
      try {
        const messages: ThreadMessage[] = [];
        let cursor: number | null = null;
        do {
          const qs: string = cursor !== null ? `?cursor=${cursor}&limit=100` : "?limit=100";
          const res = await fetch(`/api/threads/${threadId}/messages${qs}`);
          if (!res.ok) throw new Error(`Failed to load thread (${res.status})`);
          const page: { messages: ThreadMessage[]; nextCursor: number | null } = await res.json();
          messages.push(...page.messages);
          cursor = page.nextCursor;
        } while (cursor !== null);

        const rebuilt = await Promise.all(
          messages.map(async (m): Promise<Turn> => {
            const res = await fetch(`/api/turns/${m.threadResponseId}/result`);
            if (!res.ok) {
              return { threadResponseId: m.threadResponseId, question: m.question, blocks: [], status: "failed" };
            }
            const data: { status: string; events: Array<Record<string, unknown>> } = await res.json();
            let blocks: Block[] = [];
            for (const raw of data.events || []) {
              const { sseEventType, ...rest } = raw;
              blocks = reduceTurn(blocks, { type: String(sseEventType), ...rest } as TurnEvent);
            }
            // A replayed turn is settled: questions were answered or abandoned,
            // and no reasoning is still in flight (turns persisted under the
            // older contract may lack per-segment thinking_done frames).
            blocks = blocks.map((b) =>
              b.kind === "question" ? { ...b, answered: true } : b.kind === "thinking" ? { ...b, done: true } : b
            );
            const status = m.status === "FINISHED" ? "finished" : m.status === "INTERRUPTED" ? "interrupted" : m.status === "FAILED" ? "failed" : "finished";
            return { threadResponseId: m.threadResponseId, question: m.question, blocks, status };
          })
        );
        if (!cancelled) setTurns(rebuilt);
      } catch (e) {
        if (!cancelled) setBanner((e as Error).message);
      } finally {
        if (!cancelled) setLoadingHistory(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [initialThreadId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [turns, loadingHistory]);

  const patchLastTurn = useCallback((fn: (t: Turn) => Turn) => {
    setTurns((prev) => {
      if (prev.length === 0) return prev;
      const next = prev.slice();
      next[next.length - 1] = fn(next[next.length - 1]);
      return next;
    });
  }, []);

  const send = useCallback(
    async (question: string, rawFiles: File[]) => {
      setBanner(null);
      let files: UploadedFile[] | undefined;

      if (rawFiles.length > 0) {
        // All attachments for a turn must go in ONE upload request (one session).
        const form = new FormData();
        for (const f of rawFiles) form.append("file", f);
        const res = await fetch("/api/uploads", { method: "POST", body: form });
        const data = await res.json();
        if (!res.ok) {
          setBanner(data.error || "Upload failed");
          return;
        }
        files = data.files;
      }

      setTurns((prev) => [...prev, { question, files, blocks: [], status: "streaming" }]);
      setStreaming(true);
      liveResponseId.current = null;

      try {
        await streamSse("/api/ask", { question, threadId: liveThreadId.current ?? undefined, files, memoryNamespace }, (frame) => {
          if (frame.event === "init") {
            const tid = Number(frame.data.threadId);
            liveResponseId.current = Number(frame.data.threadResponseId);
            patchLastTurn((t) => ({ ...t, threadResponseId: liveResponseId.current! }));
            setThreadId(tid);
            if (liveThreadId.current === null) {
              liveThreadId.current = tid;
              onThreadCreated(tid, question);
            } else {
              onThreadActivity(tid);
            }
            return;
          }
          if (frame.event === "done") {
            patchLastTurn((t) => ({ ...t, status: t.status === "streaming" ? "finished" : t.status }));
            return;
          }
          patchLastTurn((t) => ({
            ...t,
            blocks: reduceTurn(t.blocks, { type: frame.event, ...frame.data } as TurnEvent),
            status: frame.event === "error" ? "failed" : t.status,
          }));
        });
      } catch (e) {
        const message = (e as Error).message;
        patchLastTurn((t) => ({
          ...t,
          status: t.status === "streaming" ? "failed" : t.status,
          blocks: message.includes("abort") ? t.blocks : reduceTurn(t.blocks, { type: "error", error: message }),
        }));
      } finally {
        setStreaming(false);
      }
    },
    [memoryNamespace, onThreadCreated, onThreadActivity, patchLastTurn]
  );

  const cancel = useCallback(async () => {
    const id = liveResponseId.current;
    if (!id) return;
    try {
      await fetch(`/api/ask/${id}/cancel`, { method: "POST" });
      patchLastTurn((t) => ({ ...t, status: "interrupted" }));
    } catch {
      /* stream teardown will surface the state */
    }
  }, [patchLastTurn]);

  const answerQuestion = useCallback(
    async (block: QuestionBlockT, answer: string) => {
      const id = liveResponseId.current;
      if (!id) return;
      const res = await fetch(`/api/ask/${id}/user-input`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionId: block.questionId, freeText: answer, answers: [answer] }),
      });
      if (res.ok) {
        patchLastTurn((t) => ({
          ...t,
          blocks: t.blocks.map((b) => (b.blockId === block.blockId && b.kind === "question" ? { ...b, answered: true } : b)),
        }));
      } else {
        const data = await res.json().catch(() => ({}));
        setBanner(data.error || "Failed to send the reply");
      }
    },
    [patchLastTurn]
  );

  // While a turn streams, pin its plan (TodoWrite) to the top of the chat.
  const liveTurn = turns[turns.length - 1];
  const liveTodos =
    streaming && liveTurn?.status === "streaming"
      ? (liveTurn.blocks.find((b) => b.kind === "todos") as Extract<Block, { kind: "todos" }> | undefined)
      : undefined;

  return (
    <div className="flex h-full flex-col">
      <div ref={scrollRef} className="flex-1 overflow-y-auto bg-slate-50 p-6">
        <div className="mx-auto max-w-3xl space-y-8">
          {liveTodos && (
            <div className="sticky top-0 z-10 -mx-2 rounded-xl bg-slate-50/95 p-2 backdrop-blur">
              <TodoList items={liveTodos.items} streaming />
            </div>
          )}
          {banner && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{banner}</div>}
          {loadingHistory && <div className="text-sm text-slate-400">Loading conversation…</div>}
          {!loadingHistory && turns.length === 0 && (
            <div className="pt-24 text-center text-slate-400">
              <div className="text-3xl">🐦</div>
              <div className="mt-2 text-lg font-medium text-slate-500">Ask Wren about your data</div>
              <div className="mt-1 text-sm">Streams the agent&apos;s thinking, tool calls and answer live. Type &quot;/&quot; for skills, 📎 to attach files.</div>
            </div>
          )}
          {turns.map((turn, i) => (
            <TurnView
              key={turn.threadResponseId ?? `live-${i}`}
              turn={turn}
              threadId={threadId}
              onAnswer={answerQuestion}
              onPreviewArtifact={onPreviewArtifact}
              onPreviewExport={onPreviewExport}
            />
          ))}
        </div>
      </div>
      <Composer streaming={streaming} onSend={send} onCancel={cancel} />
    </div>
  );
}
