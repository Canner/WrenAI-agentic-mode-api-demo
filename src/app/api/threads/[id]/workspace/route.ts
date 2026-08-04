import { NextRequest } from "next/server";
import { PROJECT_ID, wrenJson } from "@/lib/wren";

export const runtime = "nodejs";

// Lists a thread's workspace files (everything `create_artifact` produced).
// Upstream: GET /v2/projects/{pid}/threads/{tid}/workspace
//   → { files: [{ filename, contentType, lastModified }] }
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  return wrenJson(`/projects/${PROJECT_ID}/threads/${id}/workspace`);
}
