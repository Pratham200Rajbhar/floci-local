const MIME_MAP: Record<string, string> = {
  // Images
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  svg: "image/svg+xml",
  bmp: "image/bmp",
  ico: "image/x-icon",
  avif: "image/avif",
  // Documents & Code
  pdf: "application/pdf",
  json: "application/json; charset=utf-8",
  txt: "text/plain; charset=utf-8",
  csv: "text/csv; charset=utf-8",
  md: "text/markdown; charset=utf-8",
  html: "text/html; charset=utf-8",
  htm: "text/html; charset=utf-8",
  css: "text/css; charset=utf-8",
  js: "application/javascript; charset=utf-8",
  ts: "text/plain; charset=utf-8",
  jsx: "text/plain; charset=utf-8",
  tsx: "text/plain; charset=utf-8",
  xml: "application/xml; charset=utf-8",
  yaml: "text/yaml; charset=utf-8",
  yml: "text/yaml; charset=utf-8",
  log: "text/plain; charset=utf-8",
  sql: "text/plain; charset=utf-8",
  env: "text/plain; charset=utf-8",
  sh: "text/plain; charset=utf-8",
  // Media
  mp4: "video/mp4",
  webm: "video/webm",
  mov: "video/quicktime",
  mp3: "audio/mpeg",
  wav: "audio/wav",
  ogg: "audio/ogg",
};

export function getMimeType(filename: string, fallback?: string): string {
  const ext = filename.split(".").pop()?.toLowerCase() || "";
  if (MIME_MAP[ext]) {
    return MIME_MAP[ext];
  }
  if (fallback && fallback !== "application/octet-stream" && fallback !== "binary/octet-stream") {
    return fallback;
  }
  return "application/octet-stream";
}

export type ObjectPreviewKind = "image" | "pdf" | "video" | "audio" | "text" | "other";

export function getPreviewKind(filename: string, mimeType: string = ""): ObjectPreviewKind {
  if (mimeType.startsWith("image/") || /\.(png|jpe?g|gif|webp|svg|bmp|ico|avif)$/i.test(filename)) {
    return "image";
  }
  if (mimeType.includes("pdf") || /\.pdf$/i.test(filename)) {
    return "pdf";
  }
  if (mimeType.startsWith("video/") || /\.(mp4|webm|mov)$/i.test(filename)) {
    return "video";
  }
  if (mimeType.startsWith("audio/") || /\.(mp3|wav|ogg)$/i.test(filename)) {
    return "audio";
  }
  if (
    mimeType.startsWith("text/") ||
    mimeType.includes("json") ||
    mimeType.includes("xml") ||
    /\.(txt|json|csv|md|html|htm|css|js|ts|jsx|tsx|xml|yaml|yml|log|sql|env|sh|bash|py|go|rs|c|cpp|h|java)$/i.test(
      filename
    )
  ) {
    return "text";
  }
  return "other";
}
