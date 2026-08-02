import type { ThreadRef } from "./types";

// localStorage-backed state: the WrenAI API has no thread-list endpoint and its
// memory is keyed by a caller-chosen namespace, so the browser owns both.

const THREADS_KEY = "wren-demo-threads";
const NAMESPACE_KEY = "wren-demo-memory-namespace";

export function loadThreads(): ThreadRef[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(THREADS_KEY) || "[]");
  } catch {
    return [];
  }
}

export function upsertThread(ref: ThreadRef): ThreadRef[] {
  const threads = loadThreads().filter((t) => t.threadId !== ref.threadId);
  threads.unshift(ref);
  localStorage.setItem(THREADS_KEY, JSON.stringify(threads));
  return threads;
}

export function touchThread(threadId: number): ThreadRef[] {
  const threads = loadThreads();
  const t = threads.find((x) => x.threadId === threadId);
  if (t) return upsertThread({ ...t, updatedAt: Date.now() });
  return threads;
}

// Memory namespace: created once per browser on first visit (must match
// ^[a-zA-Z0-9][a-zA-Z0-9_-]{0,127}$).
export function getMemoryNamespace(): string {
  if (typeof window === "undefined") return "demo-ssr";
  let ns = localStorage.getItem(NAMESPACE_KEY);
  if (!ns) {
    ns = `demo-${Math.random().toString(36).slice(2, 10)}`;
    localStorage.setItem(NAMESPACE_KEY, ns);
  }
  return ns;
}
