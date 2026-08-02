import { PROJECT_ID, wrenJson } from "@/lib/wren";

export const runtime = "nodejs";

export async function GET() {
  return wrenJson(`/projects/${PROJECT_ID}/skills`);
}
