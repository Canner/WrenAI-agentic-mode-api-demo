// Server-side helper for calling the WrenAI v2 API. Never import from client
// code — the API key must not reach the browser, which is why every WrenAI
// call in this app goes through a Next.js route handler.

const BASE = process.env.WREN_API_BASE || "https://cloud.getwren.ai/api/v2";
const KEY = process.env.WREN_API_KEY!;

export const PROJECT_ID = Number(process.env.WREN_PROJECT_ID);

/** Raw fetch against the WrenAI API with the Bearer key attached. */
export function wrenFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${KEY}`);
  return fetch(`${BASE}${path}`, { ...init, headers });
}

/** Forward a JSON endpoint's response (body + status) straight through. */
export async function wrenJson(path: string, init: RequestInit = {}): Promise<Response> {
  const upstream = await wrenFetch(path, init);
  const body = await upstream.text();
  return new Response(body, {
    status: upstream.status,
    headers: { "Content-Type": "application/json" },
  });
}
