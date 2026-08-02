import { NextRequest } from "next/server";
import { PROJECT_ID, wrenFetch } from "@/lib/wren";

export const runtime = "nodejs";

// Streams a thread-workspace file (anything `create_artifact` produced).
//
// Upstream: GET /v2/projects/{pid}/threads/{tid}/workspace/{filename}
// The `mode` query param is part of the WrenAI API itself:
//   - preview (default): bytes served inline
//   - download: adds Content-Disposition: attachment
// Responses carry the API's own security headers (nosniff, and a sandbox CSP
// for renderable markup), which we pass through untouched.
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string; filename: string }> }) {
  const { id, filename } = await ctx.params;
  const mode = req.nextUrl.searchParams.get("mode") === "download" ? "?mode=download" : "";
  const upstream = await wrenFetch(`/projects/${PROJECT_ID}/threads/${id}/workspace/${encodeURIComponent(filename)}${mode}`);
  return new Response(upstream.body, {
    status: upstream.status,
    headers: upstream.headers,
  });
}
