// Shapes shared between the WrenAI SSE contract, the /result replay endpoint,
// and the UI's rendered turn model.

export interface UploadedFile {
  fileName: string;
  filePath: string;
  fileSize?: number;
  fileType?: string;
}

export interface Skill {
  name: string;
  description: string;
  isBuiltin: boolean;
  isDisabled: boolean;
}

export interface ArtifactMeta {
  id: number;
  name: string;
  kind: string;
  description?: string | null;
  contentType?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface ThreadMessage {
  threadResponseId: number;
  question: string;
  status: string;
  createdAt: string;
}

// One SSE frame (live) or persisted event (replay). Live frames carry the type
// in the SSE `event:` field; replayed events carry it as `sseEventType`.
export interface TurnEvent {
  type: string;
  [key: string]: unknown;
}

export interface TodoItem {
  content: string;
  status: "pending" | "in_progress" | "completed" | string;
  activeForm?: string;
}

// The reducer folds events into ordered blocks for rendering.
export type Block =
  | { kind: "thinking"; blockId: string; content: string; done: boolean }
  | { kind: "answer"; blockId: string; content: string }
  | { kind: "tool"; blockId: string; toolId?: string; name: string; summary: string; input: string; output: string; done: boolean }
  | { kind: "chart"; blockId: string; spec: Record<string, unknown>; caption?: string }
  | { kind: "subagent"; blockId: string; name: string; events: string[]; done: boolean }
  // Two tiers of artifacts (see README): a thread-workspace file has no
  // artifactId and is fetched by filename; a promoted project artifact carries
  // the numeric id used with the presigned-url endpoint.
  | { kind: "artifact"; blockId: string; artifactId?: number; name: string; artifactKind: string; description?: string }
  | { kind: "export"; blockId: string; filename: string; downloadUrl: string; contentType: string; sizeBytes?: number; description?: string }
  | { kind: "todos"; blockId: string; items: TodoItem[] }
  | { kind: "question"; blockId: string; questionId?: string; text: string; options: string[]; answered: boolean }
  | { kind: "error"; blockId: string; message: string };

export interface Turn {
  threadResponseId?: number;
  question: string;
  files?: UploadedFile[];
  blocks: Block[];
  status: "streaming" | "finished" | "failed" | "interrupted";
}

export interface ThreadRef {
  threadId: number;
  title: string;
  updatedAt: number;
}
