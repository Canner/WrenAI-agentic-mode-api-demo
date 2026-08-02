import { NextRequest } from "next/server";
import { wrenJson } from "@/lib/wren";

export const runtime = "nodejs";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  return wrenJson(`/stream/agent_ask/${id}/result`);
}
