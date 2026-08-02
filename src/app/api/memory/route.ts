import { NextRequest } from "next/server";
import { PROJECT_ID, wrenJson } from "@/lib/wren";

export const runtime = "nodejs";

// GET /api/memory?ns=...            -> namespace content + file manifest
// GET /api/memory?ns=...&path=...   -> a single memory file
// DELETE /api/memory?ns=...         -> wipe the namespace
export async function GET(req: NextRequest) {
  const ns = req.nextUrl.searchParams.get("ns");
  const path = req.nextUrl.searchParams.get("path");
  if (!ns) return Response.json({ error: "ns is required" }, { status: 400 });
  if (path) {
    return wrenJson(`/projects/${PROJECT_ID}/memories/${encodeURIComponent(ns)}/file?path=${encodeURIComponent(path)}`);
  }
  return wrenJson(`/projects/${PROJECT_ID}/memories/${encodeURIComponent(ns)}`);
}

export async function DELETE(req: NextRequest) {
  const ns = req.nextUrl.searchParams.get("ns");
  if (!ns) return Response.json({ error: "ns is required" }, { status: 400 });
  return wrenJson(`/projects/${PROJECT_ID}/memories/${encodeURIComponent(ns)}`, { method: "DELETE" });
}
