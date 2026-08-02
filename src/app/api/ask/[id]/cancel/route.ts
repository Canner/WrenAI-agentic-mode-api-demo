import { NextRequest } from "next/server";
import { PROJECT_ID, wrenJson } from "@/lib/wren";

export const runtime = "nodejs";

export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  return wrenJson(`/stream/agent_ask/${id}/cancellation`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ projectId: PROJECT_ID }),
  });
}
