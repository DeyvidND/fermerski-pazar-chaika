/**
 * Body → render-ready HTML. New bodies are already server-sanitized HTML
 * (passthrough); legacy bodies are plain text → escape + split blank lines
 * into <p>. Mirrors the FarmFlow admin + storefront helper.
 */
export function bodyToHtml(body: string | null | undefined): string {
  if (!body) return '';
  if (/<[a-z][\s\S]*>/i.test(body)) return body;
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return body
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p>${esc(p)}</p>`)
    .join('');
}
