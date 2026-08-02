// Small client-side helpers shared by chat and panels.

export async function getArtifactUrl(artifactId: number, mode: "preview" | "download"): Promise<{ url: string; contentType?: string; name?: string }> {
  const res = await fetch(`/api/artifacts/${artifactId}/url`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mode }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Failed to get artifact URL (${res.status})`);
  }
  return res.json();
}

export const ALLOWED_EXTENSIONS = [
  ".csv", ".doc", ".docx", ".pdf", ".xls", ".xlsx", ".sql", ".yaml", ".yml", ".md", ".json", ".txt", ".zip",
];

export function isAllowedFile(name: string): boolean {
  const lower = name.toLowerCase();
  return ALLOWED_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

// Formats we can render in the preview side panel.
export type PreviewKind = "markdown" | "html" | "pdf";

export function previewKind(filename: string, contentType?: string): PreviewKind | null {
  const name = filename.toLowerCase();
  const type = (contentType || "").toLowerCase();
  if (type.includes("markdown") || name.endsWith(".md") || name.endsWith(".markdown")) return "markdown";
  if (type.includes("text/html") || name.endsWith(".html") || name.endsWith(".htm")) return "html";
  if (type.includes("application/pdf") || name.endsWith(".pdf")) return "pdf";
  return null;
}

export function formatBytes(n?: number): string {
  if (n === undefined) return "";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}
