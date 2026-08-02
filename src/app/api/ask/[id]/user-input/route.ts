import { NextRequest } from "next/server";
import { PROJECT_ID, wrenJson } from "@/lib/wren";

export const runtime = "nodejs";

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const body = await req.json();
  return wrenJson(`/stream/agent_ask/${id}/user_input`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...body, projectId: PROJECT_ID }),
  });
}
