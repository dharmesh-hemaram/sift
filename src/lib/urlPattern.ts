// Strip query params and collapse path segments that look like IDs
// (numeric, or uuid-shaped) into `:id`, per SPEC.md §1.
export function normalizeUrlPattern(rawUrl: string): string {
  let pathname: string;
  try {
    pathname = new URL(rawUrl).pathname;
  } catch {
    pathname = rawUrl.split("?")[0] ?? rawUrl;
  }

  const idLike = /^(\d+|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;

  return pathname
    .split("/")
    .map((segment) => (idLike.test(segment) ? ":id" : segment))
    .join("/");
}
