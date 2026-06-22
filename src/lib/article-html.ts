/**
 * Body → render-ready HTML. New bodies are already server-sanitized HTML
 * (passthrough); legacy bodies are plain text → escape + split blank lines
 * into <p>. Mirrors the ФермериБГ admin + storefront helper.
 */
export function bodyToHtml(body: string | null | undefined): string {
  if (!body) return '';
  // Collapse non-breaking spaces — WYSIWYG paste (Word/PDF) joins whole paragraphs
  // with &nbsp;, which can't wrap → text overflows the column + scrolls phones sideways.
  body = body.replace(/&nbsp;/gi, ' ').replace(/ /g, ' ');
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
