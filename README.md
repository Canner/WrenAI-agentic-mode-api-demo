# WrenAI Agentic Mode — Example App

A complete, commented example of building a chat product on the
[WrenAI Agentic Mode API](https://wrenai.readme.io/v1.7/reference/agentic_mode):
streaming turns with live thinking and tool calls, file uploads, skills,
per-user memory, plans, and artifact preview/download.

![Chat with streaming thinking, tool calls and an inline chart](docs/screenshots/chat.png)

## Quick start

```bash
cp .env.example .env.local   # fill in your project id + API key
npm install
npm run dev                  # → http://localhost:3000
```

`.env.local` needs just two values (from a WrenAI Cloud **agentic** project):

```bash
WREN_PROJECT_ID=123
WREN_API_KEY=sk-your-project-api-key
# Optional — defaults to https://cloud.getwren.ai/api/v2
# WREN_API_BASE=...
```

The API key never reaches the browser: every WrenAI call goes through a
Next.js route handler under [`src/app/api/`](src/app/api), which also pipes
the SSE stream through unchanged.

## What it demonstrates

| Feature | Where to look |
| --- | --- |
| Ask & stream a turn (thinking, tools, answer) | [`src/lib/sse.ts`](src/lib/sse.ts), [`src/lib/turnReducer.ts`](src/lib/turnReducer.ts), [`src/components/Chat.tsx`](src/components/Chat.tsx) |
| Restore a thread after reload | `Chat.tsx` — replays `GET .../result` through the **same reducer** as the live stream |
| File uploads attached to a turn | [`src/app/api/uploads/route.ts`](src/app/api/uploads/route.ts), [`src/components/Composer.tsx`](src/components/Composer.tsx) |
| New chat / thread management | [`src/lib/store.ts`](src/lib/store.ts), [`src/app/page.tsx`](src/app/page.tsx) |
| Skills list + `/` autocomplete | `Composer.tsx` |
| Per-user memory (view + wipe) | [`src/components/MemoryPanel.tsx`](src/components/MemoryPanel.tsx) |
| Plans (TodoWrite) as a live checklist | `turnReducer.ts`, [`src/components/TurnView.tsx`](src/components/TurnView.tsx) |
| Workspace files: in-chat cards + per-conversation Files drawer | `TurnView.tsx`, [`src/components/FilesDrawer.tsx`](src/components/FilesDrawer.tsx), [`src/components/PreviewPanel.tsx`](src/components/PreviewPanel.tsx) |
| Inline ECharts from `render_chart` results | [`src/components/EChart.tsx`](src/components/EChart.tsx) |
| Human-in-the-loop (`user_question` → `user_input`) | `TurnView.tsx` + `Chat.tsx` |
| Cancel a running turn | `Chat.tsx` → `POST .../cancellation` |
| Recover a turn whose SSE socket dropped | `Chat.tsx` — polls `GET .../status`, then replays `GET .../result` |

## How the API is used

| App route (proxy) | WrenAI endpoint |
| --- | --- |
| `POST /api/ask` | `POST /v2/stream/agent_ask` — SSE passed straight through |
| `POST /api/ask/{id}/user-input` | `POST /v2/stream/agent_ask/{id}/user_input` |
| `POST /api/ask/{id}/cancel` | `POST /v2/stream/agent_ask/{id}/cancellation` |
| `GET /api/turns/{id}/result` | `GET /v2/stream/agent_ask/{id}/result` |
| `GET /api/turns/{id}/status` | `GET /v2/stream/agent_ask/{id}/status` |
| `GET /api/threads/{id}/messages` | `GET /v2/projects/{pid}/threads/{tid}/messages` |
| `GET /api/threads/{id}/workspace` | `GET /v2/projects/{pid}/threads/{tid}/workspace` — list a thread's files |
| `GET /api/threads/{id}/workspace/{filename}` | `GET /v2/projects/{pid}/threads/{tid}/workspace/{filename}` |
| `POST /api/uploads` | `POST /v2/projects/{pid}/uploads` |
| `GET /api/skills` | `GET /v2/projects/{pid}/skills` |
| `GET/DELETE /api/memory?ns=…` | `GET/DELETE /v2/projects/{pid}/memories/{ns}` (+ `/file`) |
| `GET /api/proxy-file?url=…` | (helper) re-serves signed export URLs inline for previews |

## Integration notes

The details below are the things we learned building this — they're what you
need to know beyond the endpoint reference.

### The SSE stream & one reducer

`POST /v2/stream/agent_ask` streams frames: `init` first (grab `threadId` +
`threadResponseId` — nothing else in the stream carries them), then
`thinking` / `answer` in fragments keyed by `block_id`, `tool_call` /
`tool_result` **paired by their `id` field** (tools run in parallel — don't
match "latest tool"), `thinking_done` closing each reasoning segment with its
`block_id`, and a terminal `done` with token `usage`.

Everything renders through **one reducer** ([`turnReducer.ts`](src/lib/turnReducer.ts))
that consumes both the live stream and the `GET .../result` replay (events
there carry `sseEventType`). Write it once and a restored conversation looks
identical to the live one. Unknown event types must be ignored — the contract
adds new types without a version bump.

`EventSource` can't POST, so [`sse.ts`](src/lib/sse.ts) parses the stream from
a `fetch` body reader (~40 lines).

### Artifacts live in the thread workspace

![Artifact card with preview and download](docs/screenshots/artifacts.png)

Every file the agent produces is a **workspace file** (`create_artifact`).
It is announced *only* by its `tool_result` (`{filename, content_type, …}`) —
there is no URL-minting step, the response body IS the file:

```
GET /v2/projects/{pid}/threads/{tid}/workspace              # list a thread's files
GET /v2/projects/{pid}/threads/{tid}/workspace/{filename}   # the bytes; ?mode=download for attachment
```

Workspace files are scoped to one conversation, so the UI keeps them there:
file cards inline in the chat, plus a "Files" drawer in the chat header
([`FilesDrawer.tsx`](src/components/FilesDrawer.tsx)) listing that thread's
workspace. Preview whitelist: markdown, HTML, PDF — rendered in a slide-over
panel ([`PreviewPanel.tsx`](src/components/PreviewPanel.tsx)).

![Files drawer listing the conversation's workspace](docs/screenshots/thread-files.png)

![Slide-over previewing an HTML report from the thread workspace](docs/screenshots/preview.png)

When the user asks to keep a file, the agent calls `save_artifact_to_project`
and an `artifact` SSE frame fires — this app renders it as a "kept" badge on
the file's card; the bytes still come from the workspace endpoint.

Separately, the **export tools** (`export_file`, `export_text`) return a
signed `download_url` in their tool result. Those URLs force
`Content-Disposition: attachment` and send no CORS headers, so this app
previews them through a tiny server proxy ([`proxy-file`](src/app/api/proxy-file/route.ts)).

### Plans (TodoWrite)

![Plan checklist rendered from TodoWrite calls](docs/screenshots/plan.png)

The agent tracks multi-step work with a `TodoWrite` tool. Each call re-sends
the **entire** todo list (`{content, status, activeForm}`), so the reducer
keeps a single plan block per turn and updates it in place. While the turn
streams, the app pins the plan to the top of the chat (showing the
in-progress item's `activeForm`); once finished it renders inline as a
settled checklist.

### Memory

![Memory panel showing MEMORY.md for a namespace](docs/screenshots/memory.png)

Memory is **off unless you send `memoryNamespace`** on the ask — typically
your own end-user id (this demo generates one per browser in
[`store.ts`](src/lib/store.ts)). The agent writes memory during turns;
whatever the namespace holds is injected into its prompt at the start of
every turn with that namespace — across threads. The HTTP surface is
read + wipe only:

```
GET    /v2/projects/{pid}/memories/{ns}          # MEMORY.md + file manifest
GET    /v2/projects/{pid}/memories/{ns}/file?path=…
DELETE /v2/projects/{pid}/memories/{ns}          # GDPR wipe
```

### Skills

![Skills autocomplete triggered by "/"](docs/screenshots/skills.png)

`GET /v2/projects/{pid}/skills` returns built-in and project skills. This app
shows them in a `/`-triggered autocomplete; picking one prefixes the question
with `Use the <name> skill: ` — routing is by plain text, there is no
"invoke skill" parameter.

### Threads & history

There is **no thread-list endpoint** — the app keeps its thread list in
`localStorage` ([`store.ts`](src/lib/store.ts)). To restore a conversation:
`GET .../threads/{tid}/messages` gives each turn's question + status; the
full content is rebuilt per turn from `GET .../result` through the shared
reducer.

### Turn lifecycle rules worth knowing

- **One turn per thread at a time** — a concurrent ask returns `409`.
- Send an **`Idempotency-Key`** on every ask; a retried request replays the
  original turn instead of billing a second one ([`ask/route.ts`](src/app/api/ask/route.ts)).
- **A dropped stream ≠ a dead turn.** A proxy in front of the API may cap how
  long one request may stay open, however busy the stream is — on the
  deployment we measured, requests were cut at 90s while frames were still
  arriving every few seconds, so heartbeats would not have helped. The turn
  keeps running server-side and finishes: poll `GET .../status` until it
  reports a terminal state, then rebuild the turn from `GET .../result`
  (`Chat.tsx` does exactly this instead of surfacing a network error). Any turn
  that outlives the cap has to be finished this way, so treat the SSE stream as
  a best-effort live view and `/result` as the source of truth.
- **`user_question` keeps the stream open** — reply via the `user_input`
  side-channel with the frame's `question_id`; the turn resumes on the same
  stream. Guard against double-submits: answering the same question twice
  returns `404`.
- **All attachments for a turn must come from ONE upload request** — a
  `files` array spanning two `uploadSessionId`s is rejected with `400`.
- Allowed upload extensions: csv, doc(x), pdf, xls(x), sql, yaml/yml, md,
  json, txt, zip — max 10 files per request.
- **`status` has no "running" value.** A turn's status is written when the turn
  settles, so `GET .../status` answers `NOT_STARTED` for the entire time it is
  in flight and only then flips to `FINISHED` / `INTERRUPTED` / `FAILED`. Poll
  it for *terminal or not*, never to mean "hasn't begun".

## Project layout

```
src/
  lib/
    wren.ts          server-side fetch helper (API key lives here only)
    sse.ts           SSE-over-fetch frame parser
    turnReducer.ts   events → renderable blocks (live + replay)
    store.ts         localStorage: thread list, memory namespace
    types.ts         event / block / API types
    client.ts        preview whitelist, upload whitelist, formatters
  app/api/           one proxy route per WrenAI endpoint (see table above)
  components/
    Chat.tsx         turn orchestration: send, stream, restore, recover, cancel
    Composer.tsx     input, attachments, "/" skills autocomplete
    TurnView.tsx     renders blocks: thinking, tools, charts, cards, questions
    PreviewPanel.tsx slide-over file preview (workspace + export files)
    FilesDrawer.tsx  per-conversation workspace file drawer (chat header)
    MemoryPanel.tsx  memory view + wipe
    EChart.tsx       ECharts wrapper for render_chart specs
```
