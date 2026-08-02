import { NextRequest } from "next/server";
import { PROJECT_ID, wrenFetch } from "@/lib/wren";

export const runtime = "nodejs";

// Proxies the agent turn and pipes the upstream SSE body straight through.
export async function POST(req: NextRequest) {
  const body = await req.json();
  const upstream = await wrenFetch("/stream/agent_ask", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Idempotency-Key": crypto.randomUUID(),
    },
    body: JSON.stringify({ ...body, projectId: PROJECT_ID }),
    // @ts-expect-error -- undici option required to stream request/response bodies
    duplex: "half",
  });

  if (!upstream.ok || !upstream.body) {
    const text = await upstream.text();
    return new Response(text, {
      status: upstream.status,
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(upstream.body, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
