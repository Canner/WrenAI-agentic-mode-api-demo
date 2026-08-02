import type { Block, TurnEvent } from "./types";

/**
 * Folds one agentic-mode SSE event into an ordered list of renderable blocks.
 *
 * This is the heart of the integration: ONE reducer consumes both the live
 * stream (`POST /v2/stream/agent_ask`) and the replay of a finished turn
 * (`GET /v2/stream/agent_ask/{threadResponseId}/result`, where each persisted
 * event carries its type as `sseEventType`). Writing it once means a restored
 * conversation looks pixel-identical to the live one.
 *
 * Contract notes this reducer encodes:
 * - `thinking` / `answer` stream in fragments that share a `block_id`;
 *   concatenate fragments with the same id.
 * - `thinking_done` closes one reasoning segment and carries its `block_id`.
 * - `tool_call` / `tool_result` pair by their `id` field — tools run in
 *   parallel, so "most recent tool" matching would attach results to the
 *   wrong call.
 * - Unknown event types MUST be ignored: the SSE contract is versioned and
 *   new event types may be added without a version bump.
 */

/** Coerce any payload value to a display string. */
function str(v: unknown, fallback = ""): string {
  if (typeof v === "string") return v;
  if (v == null) return fallback;
  return typeof v === "object" ? JSON.stringify(v) : String(v);
}

/** First present key wins — tolerant of casing differences across events. */
function pick(e: TurnEvent, ...keys: string[]): unknown {
  for (const k of keys) if (e[k] !== undefined && e[k] !== null) return e[k];
  return undefined;
}

let anonCounter = 0;
function blockIdOf(e: TurnEvent, prefix: string): string {
  return str(pick(e, "block_id", "blockId"), `${prefix}-${anonCounter++}`);
}

export function reduceTurn(blocks: Block[], e: TurnEvent): Block[] {
  const next = blocks.slice();

  /** Latest block of a kind (optionally by block id), searched from the end. */
  const last = <K extends Block["kind"]>(kind: K, blockId?: string) => {
    for (let i = next.length - 1; i >= 0; i--) {
      const b = next[i];
      if (b.kind === kind && (blockId === undefined || b.blockId === blockId)) {
        return { block: b as Extract<Block, { kind: K }>, index: i };
      }
    }
    return null;
  };

  switch (e.type) {
    // ── Reasoning ────────────────────────────────────────────────────────
    case "thinking": {
      const blockId = blockIdOf(e, "thinking");
      const found = last("thinking", blockId);
      const content = str(pick(e, "content", "text"));
      if (found && !found.block.done) {
        next[found.index] = { ...found.block, content: found.block.content + content };
      } else {
        next.push({ kind: "thinking", blockId, content, done: false });
      }
      return next;
    }
    case "thinking_done": {
      // Fired once per reasoning segment with its block_id. If the id is
      // missing (turns persisted under an older contract), close every open
      // segment — by that point the agent has moved on anyway.
      const blockId = pick(e, "block_id", "blockId");
      return next.map((b) =>
        b.kind === "thinking" && !b.done && (blockId === undefined || b.blockId === String(blockId)) ? { ...b, done: true } : b
      );
    }

    // ── Answer text (markdown, streamed) ─────────────────────────────────
    case "answer": {
      const blockId = blockIdOf(e, "answer");
      const found = last("answer", blockId);
      const content = str(pick(e, "content", "text"));
      if (found) {
        next[found.index] = { ...found.block, content: found.block.content + content };
      } else {
        next.push({ kind: "answer", blockId, content });
      }
      return next;
    }

    // ── Tools ────────────────────────────────────────────────────────────
    case "tool_call": {
      const input = pick(e, "input", "arguments", "args", "content");
      const toolName = str(pick(e, "name", "tool_name", "toolName", "tool"), "tool");

      // TodoWrite is the agent's plan. Each call re-sends the FULL todo list,
      // so we keep a single `todos` block per turn and update it in place —
      // the UI renders it as a live checklist rather than a chip per call.
      if (toolName === "TodoWrite" && input && typeof input === "object" && Array.isArray((input as Record<string, unknown>).todos)) {
        const items = ((input as Record<string, unknown>).todos as Array<Record<string, unknown>>).map((t) => ({
          content: str(t.content),
          status: str(t.status, "pending"),
          activeForm: t.activeForm ? str(t.activeForm) : undefined,
        }));
        const existing = next.findIndex((b) => b.kind === "todos");
        if (existing >= 0) {
          next[existing] = { ...(next[existing] as Extract<Block, { kind: "todos" }>), items };
        } else {
          next.push({ kind: "todos", blockId: blockIdOf(e, "todos"), items });
        }
        return next;
      }

      // A one-line gist for the chip header — the file for Read, the command
      // for Bash, the SQL for query tools — so users see WHAT ran at a glance.
      let summary = "";
      if (input && typeof input === "object") {
        const obj = input as Record<string, unknown>;
        for (const key of ["file_path", "path", "command", "sql", "query", "skill", "question", "content", "args"]) {
          if (typeof obj[key] === "string" && (obj[key] as string).trim()) {
            summary = obj[key] as string;
            break;
          }
        }
      } else if (typeof input === "string") {
        summary = input;
      }

      next.push({
        kind: "tool",
        blockId: blockIdOf(e, "tool"),
        toolId: pick(e, "id", "tool_call_id") as string | undefined,
        name: toolName,
        summary: summary.replace(/\s+/g, " ").trim(),
        input: input && typeof input === "object" ? JSON.stringify(input, null, 2) : str(input),
        output: "",
        done: false,
      });
      return next;
    }

    case "tool_result": {
      // Pair with the matching tool_call by call id — NOT "the latest tool",
      // because the agent frequently runs tools in parallel.
      const toolId = pick(e, "id", "tool_call_id") as string | undefined;
      let index = -1;
      for (let i = next.length - 1; i >= 0; i--) {
        const b = next[i];
        if (b.kind === "tool" && !b.done && (toolId === undefined || b.toolId === toolId)) {
          index = i;
          break;
        }
      }
      const output = str(pick(e, "output", "result", "content"));
      if (index >= 0) {
        const b = next[index] as Extract<Block, { kind: "tool" }>;
        next[index] = { ...b, done: true, output };
      }

      // render_chart results carry a full ECharts spec inline (`chart_spec` +
      // `caption`) — render it as a real chart instead of a JSON blob.
      const spec = pick(e, "chart_spec", "chartSpec");
      if (spec && typeof spec === "object") {
        next.push({
          kind: "chart",
          blockId: blockIdOf(e, "chart"),
          spec: spec as Record<string, unknown>,
          caption: pick(e, "caption") as string | undefined,
        });
      }

      // Export tools (export_file, export_text, …) return a short-lived signed
      // `download_url`. Detect the output SHAPE rather than the tool name so
      // new export variants keep working.
      if (output.includes("download_url")) {
        try {
          const out = JSON.parse(output);
          if (out.download_url) {
            next.push({
              kind: "export",
              blockId: blockIdOf(e, "export"),
              filename: String(out.filename || "download"),
              downloadUrl: String(out.download_url),
              contentType: String(out.content_type || ""),
              sizeBytes: typeof out.size_bytes === "number" ? out.size_bytes : undefined,
              description: out.description ? String(out.description) : undefined,
            });
          }
        } catch {
          /* non-JSON output */
        }
      }

      // create_artifact writes a file into the THREAD WORKSPACE. It is
      // announced only here (no `artifact` SSE frame — that frame is reserved
      // for files promoted to the project library). The tool result carries
      // the filename; the bytes are fetched from
      // GET /v2/projects/{pid}/threads/{tid}/workspace/{filename}.
      if (str(pick(e, "name")).includes("create_artifact")) {
        try {
          const out = JSON.parse(output);
          if (out.filename) {
            next.push({
              kind: "artifact",
              blockId: blockIdOf(e, "file"),
              name: String(out.filename),
              artifactKind: String(out.content_type || "file"),
              description: out.description ? String(out.description) : undefined,
            });
          }
        } catch {
          /* non-JSON output */
        }
      }
      return next;
    }

    // ── Subagents (delegated sub-tasks) ──────────────────────────────────
    case "subagent_start": {
      next.push({
        kind: "subagent",
        blockId: blockIdOf(e, "subagent"),
        name: str(pick(e, "name", "subagent", "task", "description"), "subagent"),
        events: [],
        done: false,
      });
      return next;
    }
    case "subagent_thinking":
    case "subagent_sql_query":
    case "subagent_sql_result": {
      const found = last("subagent");
      if (found) {
        const label = e.type === "subagent_thinking" ? "" : e.type === "subagent_sql_query" ? "SQL: " : "→ ";
        const text = str(pick(e, "content", "sql", "result", "text"));
        const events = found.block.events.slice();
        // Subagent thinking streams in fragments; concatenate onto the last line.
        if (e.type === "subagent_thinking" && events.length > 0 && !events[events.length - 1].startsWith("SQL: ") && !events[events.length - 1].startsWith("→ ")) {
          events[events.length - 1] += text;
        } else {
          events.push(label + text);
        }
        next[found.index] = { ...found.block, events };
      }
      return next;
    }
    case "subagent_end": {
      const found = last("subagent");
      if (found) next[found.index] = { ...found.block, done: true };
      return next;
    }

    // ── Project artifacts ────────────────────────────────────────────────
    // Fires only when a file is PROMOTED into the project library (the agent
    // called save_artifact_to_project because the user asked to keep it).
    // Carries a numeric artifactId usable with the presigned-url endpoint.
    case "artifact": {
      const rawId = pick(e, "artifactId", "artifact_id", "id");
      next.push({
        kind: "artifact",
        blockId: blockIdOf(e, "artifact"),
        artifactId: rawId !== undefined && Number.isFinite(Number(rawId)) ? Number(rawId) : undefined,
        name: str(pick(e, "filename", "fileName", "name"), "artifact"),
        artifactKind: str(pick(e, "kind"), "file"),
      });
      return next;
    }

    // ── Human-in-the-loop checkpoints ────────────────────────────────────
    // The stream stays open; reply via POST .../user_input with the
    // question_id and the turn resumes on the SAME stream.
    case "user_question":
    case "agent_form":
    case "plan_review": {
      const rawOptions = pick(e, "options", "choices");
      next.push({
        kind: "question",
        blockId: blockIdOf(e, "question"),
        questionId: pick(e, "question_id", "questionId", "id") as string | undefined,
        text: str(pick(e, "question", "text", "content", "title"), "The agent needs your input."),
        options: Array.isArray(rawOptions)
          ? rawOptions.map((o) => str(typeof o === "object" && o !== null ? (o as Record<string, unknown>).label ?? (o as Record<string, unknown>).value ?? o : o))
          : [],
        answered: false,
      });
      return next;
    }

    case "error": {
      next.push({
        kind: "error",
        blockId: blockIdOf(e, "error"),
        message: str(pick(e, "error", "message", "content"), "The turn failed."),
      });
      return next;
    }

    default:
      // Unknown event types must be ignored (forward-compatible contract).
      return blocks;
  }
}
