"use client";

import { useCallback, useEffect, useState } from "react";
import type { ThreadRef } from "@/lib/types";
import { getMemoryNamespace, loadThreads, touchThread, upsertThread } from "@/lib/store";
import Sidebar, { type Panel } from "@/components/Sidebar";
import Chat from "@/components/Chat";
import MemoryPanel from "@/components/MemoryPanel";
import WorkspacePanel from "@/components/WorkspacePanel";
import ArtifactPreviewModal, { type PreviewTarget } from "@/components/ArtifactPreviewModal";
import PreviewPanel, { type ExportPreviewTarget } from "@/components/PreviewPanel";

export default function Home() {
  const [threads, setThreads] = useState<ThreadRef[]>([]);
  const [namespace, setNamespace] = useState("");
  const [activeThreadId, setActiveThreadId] = useState<number | null>(null);
  // chatKey remounts Chat only on explicit navigation (new chat / pick thread),
  // never when a live turn learns its threadId from the init frame.
  const [chatKey, setChatKey] = useState("new-0");
  const [panel, setPanel] = useState<Panel>("chat");
  const [preview, setPreview] = useState<PreviewTarget | null>(null);
  const [filePreview, setFilePreview] = useState<ExportPreviewTarget | null>(null);

  useEffect(() => {
    setThreads(loadThreads());
    setNamespace(getMemoryNamespace());
  }, []);

  const newChat = useCallback(() => {
    setActiveThreadId(null);
    setChatKey(`new-${Date.now()}`);
    setPanel("chat");
  }, []);

  const selectThread = useCallback((id: number) => {
    setActiveThreadId(id);
    setChatKey(`thread-${id}`);
    setPanel("chat");
  }, []);

  const onThreadCreated = useCallback((threadId: number, title: string) => {
    setActiveThreadId(threadId);
    setThreads(upsertThread({ threadId, title: title.slice(0, 60), updatedAt: Date.now() }));
  }, []);

  const onThreadActivity = useCallback((threadId: number) => {
    setThreads(touchThread(threadId));
  }, []);

  const onPreviewArtifact = useCallback((id: number, name: string) => {
    setPreview({ id, name });
  }, []);

  if (!namespace) return null; // one frame while localStorage hydrates

  return (
    <div className="flex h-screen bg-slate-50 text-slate-900">
      <Sidebar
        threads={threads}
        activeThreadId={activeThreadId}
        panel={panel}
        memoryNamespace={namespace}
        onNewChat={newChat}
        onSelectThread={selectThread}
        onSelectPanel={setPanel}
      />
      <main className="min-w-0 flex-1">
        {panel === "chat" && (
          <Chat
            key={chatKey}
            initialThreadId={chatKey.startsWith("thread-") ? activeThreadId : null}
            memoryNamespace={namespace}
            onThreadCreated={onThreadCreated}
            onThreadActivity={onThreadActivity}
            onPreviewArtifact={onPreviewArtifact}
            onPreviewExport={setFilePreview}
          />
        )}
        {panel === "memory" && <MemoryPanel namespace={namespace} />}
        {panel === "files" && <WorkspacePanel threadId={activeThreadId} onPreview={setFilePreview} />}
      </main>
      {preview && <ArtifactPreviewModal target={preview} onClose={() => setPreview(null)} />}
      {filePreview && <PreviewPanel target={filePreview} onClose={() => setFilePreview(null)} />}
    </div>
  );
}
