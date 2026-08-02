"use client";

import type { ThreadRef } from "@/lib/types";

export type Panel = "chat" | "memory" | "artifacts";

export default function Sidebar({
  threads,
  activeThreadId,
  panel,
  memoryNamespace,
  onNewChat,
  onSelectThread,
  onSelectPanel,
}: {
  threads: ThreadRef[];
  activeThreadId: number | null;
  panel: Panel;
  memoryNamespace: string;
  onNewChat: () => void;
  onSelectThread: (id: number) => void;
  onSelectPanel: (panel: Panel) => void;
}) {
  return (
    <aside className="flex w-64 shrink-0 flex-col border-r border-slate-200 bg-white">
      <div className="p-3">
        <button
          className="w-full rounded-xl bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-700"
          onClick={onNewChat}
        >
          + New chat
        </button>
      </div>

      <div className="px-3 pb-1 text-xs font-medium uppercase tracking-wide text-slate-400">Chats</div>
      <div className="min-h-0 flex-1 overflow-y-auto px-2">
        {threads.length === 0 && <div className="px-2 py-1 text-sm text-slate-400">No chats yet</div>}
        {threads.map((t) => (
          <button
            key={t.threadId}
            className={`mb-1 block w-full truncate rounded-lg px-3 py-2 text-left text-sm hover:bg-slate-100 ${
              panel === "chat" && t.threadId === activeThreadId ? "bg-slate-100 font-medium text-slate-900" : "text-slate-600"
            }`}
            onClick={() => onSelectThread(t.threadId)}
            title={t.title}
          >
            {t.title}
          </button>
        ))}
      </div>

      <div className="border-t border-slate-200 p-2">
        <button
          className={`mb-1 block w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-slate-100 ${panel === "memory" ? "bg-slate-100 font-medium" : "text-slate-600"}`}
          onClick={() => onSelectPanel("memory")}
        >
          🧠 Memory
        </button>
        <button
          className={`block w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-slate-100 ${panel === "artifacts" ? "bg-slate-100 font-medium" : "text-slate-600"}`}
          onClick={() => onSelectPanel("artifacts")}
        >
          📦 Artifacts
        </button>
        <div className="mt-2 truncate px-3 text-[11px] text-slate-400" title={memoryNamespace}>
          namespace: {memoryNamespace}
        </div>
      </div>
    </aside>
  );
}
