import { NextRequest } from "next/server";
import { PROJECT_ID, wrenJson } from "@/lib/wren";

export const runtime = "nodejs";

// Mints a short-lived presigned URL: body { mode: "preview" | "download" }.
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  return wrenJson(`/projects/${PROJECT_ID}/artifacts/${id}/presigned-url`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mode: body.mode === "preview" ? "preview" : "download" }),
  });
}
