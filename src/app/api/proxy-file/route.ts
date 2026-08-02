import { NextRequest } from "next/server";

export const runtime = "nodejs";

// Re-serves an exported file inline so the browser can preview it: the signed
// GCS URLs from export_file force `Content-Disposition: attachment` and don't
// send CORS headers, so neither iframes nor fetch can render them directly.
const ALLOWED_HOSTS = new Set(["storage.googleapis.com"]);

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url");
  if (!url) return Response.json({ error: "url is required" }, { status: 400 });

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return Response.json({ error: "invalid url" }, { status: 400 });
  }
  if (parsed.protocol !== "https:" || !ALLOWED_HOSTS.has(parsed.hostname)) {
    return Response.json({ error: "host not allowed" }, { status: 400 });
  }

  const upstream = await fetch(url);
  if (!upstream.ok || !upstream.body) {
    return Response.json({ error: `upstream fetch failed (${upstream.status})` }, { status: 502 });
  }
  return new Response(upstream.body, {
    headers: {
      "Content-Type": upstream.headers.get("Content-Type") || "application/octet-stream",
      "Content-Disposition": "inline",
      "Cache-Control": "private, max-age=300",
    },
  });
}
