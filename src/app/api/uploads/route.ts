import { NextRequest } from "next/server";
import { PROJECT_ID, wrenFetch } from "@/lib/wren";

export const runtime = "nodejs";

// Forwards the multipart form (one or more `file` parts) to the WrenAI
// uploads endpoint, which stages the files for the next turn to attach.
export async function POST(req: NextRequest) {
  const form = await req.formData();
  const upstream = await wrenFetch(`/projects/${PROJECT_ID}/uploads`, {
    method: "POST",
    body: form,
  });
  const text = await upstream.text();
  return new Response(text, {
    status: upstream.status,
    headers: { "Content-Type": "application/json" },
  });
}
