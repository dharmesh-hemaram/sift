// The rail's "Name" column, same idea as DevTools' Network tab: just the
// last path segment (query string already stripped upstream), not the
// full URL. "https://api.example.com/api/v2/accounts/123" -> "123",
// "https://jsonplaceholder.typicode.com/users" -> "users".
export function urlSlug(rawUrl: string): string {
  let pathname: string;
  try {
    pathname = new URL(rawUrl).pathname;
  } catch {
    pathname = String(rawUrl).split("?")[0] ?? String(rawUrl);
  }
  const segments = pathname.split("/").filter(Boolean);
  return segments.length ? segments[segments.length - 1]! : "/";
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function escapeHtml(str: unknown): string {
  return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Lightweight syntax coloring over an already-escaped, pretty-printed JSON
// string. No parser needed — a formatted JSON.stringify output only ever
// contains these token shapes.
export function highlightJson(escapedJson: string): string {
  return escapedJson.replace(
    /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/g,
    (match) => {
      let cls = "json-number";
      if (/^"/.test(match)) {
        cls = /:$/.test(match) ? "json-key" : "json-string";
      } else if (/true|false/.test(match)) {
        cls = "json-boolean";
      } else if (/null/.test(match)) {
        cls = "json-null";
      }
      return `<span class="${cls}">${match}</span>`;
    },
  );
}
