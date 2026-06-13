/**
 * Body → render-ready HTML. New bodies are already server-sanitized HTML
 * (passthrough); legacy bodies are plain text → escape + split blank lines
 * into <p>. Mirrors the FarmFlow admin + storefront helper.
 */
export function bodyToHtml(body: string | null | undefined): string {
  if (!body) return '';
  // HTML only when it BEGINS with a tag (server-sanitized bodies always do).
  // Legacy plain text containing a stray "<tag" mid-string is escaped below.
  if (/^\s*<[a-z]/i.test(body)) return body;
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return body
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p>${esc(p)}</p>`)
    .join('');
}
