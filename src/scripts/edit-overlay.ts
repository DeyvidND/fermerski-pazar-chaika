// src/scripts/edit-overlay.ts
/**
 * Storefront inline-edit overlay. Loaded only with ?edit=<token> (Layout gate).
 * Lets the farm edit text + photos + the FAQ list in place and save via the
 * ФермериБГ site-edit API (Bearer = the short-lived edit token). No deps.
 */
const API = import.meta.env.PUBLIC_API_BASE as string;

function getTokenAndClean(): string | null {
  const u = new URL(location.href);
  const t = u.searchParams.get('edit');
  if (!t) return null;
  u.searchParams.delete('edit');
  history.replaceState(null, '', u.toString());
  return t;
}

type Slot = { kind: 'text' | 'image'; key: string };
type Manifest = { pages: { sections: { slots: Slot[] }[] }[] };

function flattenKinds(m: Manifest): Record<string, 'text' | 'image'> {
  const out: Record<string, 'text' | 'image'> = {};
  for (const p of m.pages) for (const s of p.sections) for (const sl of s.slots) out[sl.key] = sl.kind;
  return out;
}

async function boot() {
  const token = getTokenAndClean();
  if (!token) return;
  const auth = { Authorization: `Bearer ${token}` };

  // Load slot kinds (same-origin) + current overrides + faq. Distinguish an
  // expired/invalid token (401 → re-open from the panel) from a connection/CORS
  // failure (fetch rejects with no status → check the server/CORS), so the banner
  // isn't misleadingly "session expired" when the real issue is the network/CORS.
  let kinds: Record<string, 'text' | 'image'> = {};
  try { kinds = flattenKindsSafe(await fetch('/editable-manifest.json').then(handle)); } catch { /* same-origin static; ignore */ }
  let data: { copy?: Record<string, string>; faq?: { q: string; a: string }[]; media?: Record<string, { url: string }> } | null = null;
  let failed: 'expired' | 'connect' | '' = '';
  try {
    data = await fetch(`${API}/tenants/me/site-edit/data`, { headers: auth }).then(handle);
  } catch (e) {
    failed = e instanceof Error && (e.message === '401' || e.message === '403') ? 'expired' : 'connect';
  }
  if (!data) {
    banner(failed === 'expired'
      ? 'Сесията изтече. Отвори пак „Редактирай сайта" от панела.'
      : 'Неуспешна връзка със сървъра за редактиране. Провери връзката и опитай пак.');
    return;
  }

  const draftCopy: Record<string, string> = { ...(data.copy ?? {}) };
  let draftFaq: { q: string; a: string }[] = Array.isArray(data.faq) ? data.faq.map((f: any) => ({ q: f.q, a: f.a })) : [];
  let dirty = false;
  let saving = false;
  const markDirty = () => { dirty = true; updateBar(); };

  document.documentElement.classList.add('ff-edit-on');
  injectStyles();
  introNote();
  keepEditOnNav(token);
  wireText(kinds, draftCopy, markDirty);
  wireImages(kinds, token, markDirty);
  wireFaq(draftFaq, (next) => { draftFaq = next; markDirty(); });
  const { updateBar } = buildBar(async () => {
    if (saving) return; saving = true; updateBar();
    try {
      await handle(await fetch(`${API}/tenants/me/site-edit/content`, {
        method: 'PATCH', headers: { ...auth, 'content-type': 'application/json' },
        body: JSON.stringify({ copy: cleanCopy(draftCopy), faq: cleanFaq(draftFaq) }),
      }));
      dirty = false; toast('Запазено');
    } catch (e) { console.error(e); toast('Грешка при запис'); }
    finally { saving = false; updateBar(); }
  });
  updateBar();

  function handle(r: Response) { if (!r.ok) throw new Error(String(r.status)); return r.json(); }
  function flattenKindsSafe(m: any) { try { return flattenKinds(m); } catch { return {}; } }
  function cleanCopy(c: Record<string, string>) {
    const o: Record<string, string> = {}; for (const [k, v] of Object.entries(c)) if (v && v.trim()) o[k] = v.trim(); return o;
  }
  function cleanFaq(f: { q: string; a: string }[]) {
    return f.map((x) => ({ q: (x.q || '').trim(), a: (x.a || '').trim() })).filter((x) => x.q || x.a).slice(0, 50);
  }

  // --- text slots: contenteditable, commit innerText to draft on input ---
  function wireText(kinds: Record<string, string>, draft: Record<string, string>, onChange: () => void) {
    document.querySelectorAll<HTMLElement>('[data-editable-slot]').forEach((el) => {
      const key = el.getAttribute('data-editable-slot')!;
      if (kinds[key] !== 'text') return;
      el.setAttribute('contenteditable', 'plaintext-only');
      el.classList.add('ff-edit-text');
      el.addEventListener('input', () => { draft[key] = el.innerText; onChange(); });
    });
  }

  // --- image slots: click → file picker → upload → swap ---
  function wireImages(kinds: Record<string, string>, tok: string, onChange: () => void) {
    document.querySelectorAll<HTMLElement>('[data-editable-slot]').forEach((el) => {
      const key = el.getAttribute('data-editable-slot')!;
      if (kinds[key] !== 'image') return;
      el.classList.add('ff-edit-img');
      const btn = document.createElement('button');
      btn.type = 'button'; btn.className = 'ff-edit-imgbtn';
      btn.textContent = el.querySelector('img') ? 'Смени снимка' : 'Добави снимка';
      btn.addEventListener('click', (e) => {
        e.preventDefault(); e.stopPropagation();
        const inp = document.createElement('input');
        inp.type = 'file'; inp.accept = 'image/jpeg,image/png,image/webp';
        inp.onchange = async () => {
          const file = inp.files?.[0]; if (!file) return;
          btn.textContent = 'Качване…';
          try {
            const fd = new FormData(); fd.append('image', file);
            const res = await fetch(`${API}/tenants/me/site-edit/media/${encodeURIComponent(key)}`, {
              method: 'POST', headers: { Authorization: `Bearer ${tok}` }, body: fd,
            });
            if (!res.ok) { let m = ''; try { m = (await res.json())?.message || ''; } catch {} throw new Error(m); }
            const { url } = await res.json();
            let img = el.querySelector('img');
            if (!img) { img = document.createElement('img'); img.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;object-fit:cover'; el.appendChild(img); el.querySelector('.ph__label')?.remove(); }
            img.src = url; toast('Снимката е качена'); onChange();
          } catch (e) { console.error(e); toast(e instanceof Error && e.message ? e.message : 'Грешка при качване'); }
          finally { btn.textContent = 'Смени снимка'; }
        };
        inp.click();
      });
      el.appendChild(btn);
    });
  }

  // --- FAQ: inline-edit q/a + per-item ↑↓✕ + add (only on the faq page) ---
  function wireFaq(faq: { q: string; a: string }[], setFaq: (f: { q: string; a: string }[]) => void) {
    const list = document.querySelector('.acc'); if (!list) return;
    function render() {
      list!.querySelectorAll('[data-faq-field]').forEach((node) => {
        const el = node as HTMLElement;
        const idx = Number(el.getAttribute('data-faq-index'));
        const field = el.getAttribute('data-faq-field') as 'q' | 'a';
        if (faq[idx]) el.innerText = faq[idx][field];
        el.setAttribute('contenteditable', 'plaintext-only');
        el.classList.add('ff-edit-text');
        el.oninput = () => { if (faq[idx]) { const next = faq.map((it, i) => i === idx ? { ...it, [field]: el.innerText } : it); setFaq(next); } };
      });
    }
    // per-item controls
    list.querySelectorAll<HTMLElement>('[data-faq-item]').forEach((item) => {
      const idx = Number(item.getAttribute('data-faq-item'));
      const tools = document.createElement('div'); tools.className = 'ff-faq-tools';
      const mk = (txt: string, fn: () => void) => { const b = document.createElement('button'); b.type = 'button'; b.textContent = txt; b.onclick = (e) => { e.preventDefault(); e.stopPropagation(); fn(); }; tools.appendChild(b); };
      mk('↑', () => { if (idx > 0) { const next = [...faq]; [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]]; setFaq(next); rebuild(next, setFaq); } });
      mk('↓', () => { if (idx < faq.length - 1) { const next = [...faq]; [next[idx + 1], next[idx]] = [next[idx], next[idx + 1]]; setFaq(next); rebuild(next, setFaq); } });
      mk('✕', () => { const next = faq.filter((_, i) => i !== idx); setFaq(next); rebuild(next, setFaq); });
      item.appendChild(tools);
    });
    const add = document.createElement('button'); add.type = 'button'; add.className = 'ff-faq-add'; add.textContent = '+ Добави въпрос';
    add.onclick = (e) => { e.preventDefault(); const next = [...faq, { q: 'Нов въпрос', a: 'Отговор' }]; setFaq(next); rebuild(next, setFaq); };
    list.parentElement?.appendChild(add);
    render();
  }
  // Rebuild the FAQ DOM after structural change (reorder/add/remove) by reloading the page in edit mode would lose the token; instead re-render text from the draft and toggle item visibility. Simpler: full re-render of the .acc innerHTML from the draft.
  function rebuild(faq: { q: string; a: string }[], setFaq: (f: { q: string; a: string }[]) => void) {
    const list = document.querySelector('.acc'); if (!list) return;
    list.innerHTML = faq.map((f, i) => `
      <div class="acc__item${i === 0 ? ' open' : ''}" data-faq-item="${i}">
        <button class="acc__head"><span data-faq-field="q" data-faq-index="${i}"></span><span class="ico">+</span></button>
        <div class="acc__body"><div class="acc__body-inner" data-faq-field="a" data-faq-index="${i}"></div></div>
      </div>`).join('');
    document.querySelector('.ff-faq-add')?.remove();
    wireFaq(faq, setFaq);
  }

  function buildBar(onSave: () => void) {
    const bar = document.createElement('div'); bar.className = 'ff-edit-bar';
    const status = document.createElement('span'); status.className = 'ff-edit-status';
    const save = document.createElement('button'); save.type = 'button'; save.className = 'ff-edit-save'; save.textContent = 'Запази'; save.onclick = onSave;
    const exit = document.createElement('button'); exit.type = 'button'; exit.className = 'ff-edit-exit'; exit.textContent = 'Изход от редактора';
    exit.onclick = () => { if (dirty && !confirm('Има незаписани промени. Да изляза без запис?')) return; location.href = location.pathname; };
    bar.append(status, exit, save); document.body.appendChild(bar);
    return { updateBar: () => { status.textContent = dirty ? 'Незаписани промени' : 'Режим на редактиране'; save.disabled = !dirty || saving; } };
  }
  function banner(msg: string) { const b = document.createElement('div'); b.className = 'ff-edit-bar'; b.textContent = msg; document.body.appendChild(b); }
  function toast(msg: string) { const t = document.createElement('div'); t.className = 'ff-edit-toast'; t.textContent = msg; document.body.appendChild(t); setTimeout(() => t.remove(), 2200); }

  // Persistent scope note: only the static texts + decorative photos are editable
  // here. Product/farmer/category images come from the admin panel (different slots,
  // no data-editable-slot), so clicking them does nothing — say so explicitly.
  function introNote() {
    document.documentElement.classList.add('ff-note-on');
    const n = document.createElement('div'); n.className = 'ff-edit-note';
    const msg = document.createElement('span');
    msg.innerHTML = 'Тук сменяш <b>текстовете</b> и <b>декоративните снимки</b> на сайта — кликни върху текст или снимка. Снимките на <b>продукти, фермери и категории</b> се управляват от админ панела, не оттук.';
    const x = document.createElement('button'); x.type = 'button'; x.className = 'ff-edit-note-x'; x.textContent = '✕'; x.title = 'Скрий';
    x.onclick = () => { n.remove(); document.documentElement.classList.remove('ff-note-on'); };
    n.append(msg, x); document.body.appendChild(n);
  }

  // Keep edit mode across internal navigation: clicking a same-origin link carries
  // the edit token to the next page (it loads the overlay + strips the token from
  // the URL), so the farmer can browse + edit every page without re-opening from
  // the panel. External links / new-tab / hash links navigate normally (leave edit).
  function keepEditOnNav(tok: string) {
    document.addEventListener('click', (e) => {
      const t = e.target as HTMLElement;
      // Editing a text slot nested inside a link (e.g. the footer „Вход за стопани“
      // label) — let the click place the caret instead of navigating away.
      if (t?.closest?.('[contenteditable]')) return;
      const a = t?.closest?.('a');
      if (!a) return;
      const href = a.getAttribute('href');
      if (!href || href.startsWith('#') || (a as HTMLAnchorElement).target === '_blank') return;
      let url: URL; try { url = new URL(href, location.href); } catch { return; }
      if (url.origin !== location.origin) return; // external → normal nav (leaves edit mode)
      e.preventDefault();
      if (dirty && !confirm('Има незаписани промени. Да напусна страницата без запис?')) return;
      url.searchParams.set('edit', tok);
      location.href = url.toString();
    }, true);
  }
  function injectStyles() {
    const s = document.createElement('style');
    s.textContent = `
      .ff-edit-text{outline:1px dashed rgba(63,125,67,.5);outline-offset:2px;cursor:text;border-radius:3px}
      .ff-edit-text:focus{outline:2px solid #3F7D43;background:rgba(63,125,67,.06)}
      .ff-edit-img{position:relative}
      /* Corner button + high z-index so it's reachable even when text/labels sit on
         the image (centered placeholder label, overlaid headings). Hide the slot's
         own centered placeholder text in edit mode so it can't clash with the button. */
      .ff-edit-img > .ph__label{display:none}
      /* pointer-events:auto re-enables the button even when a theme sets the image
         layer to pointer-events:none (e.g. the ferma full-bleed hero, where text is
         overlaid on the photo) — otherwise the button is visible but unclickable. */
      .ff-edit-imgbtn{position:absolute;top:8px;right:8px;z-index:9000;pointer-events:auto;background:#3F7D43;color:#fff;border:1px solid rgba(255,255,255,.55);border-radius:8px;padding:7px 12px;font:600 13px system-ui;cursor:pointer;box-shadow:0 2px 10px rgba(0,0,0,.45)}
      .ff-edit-imgbtn:hover{background:#356b39}
      .ff-faq-tools{display:flex;gap:4px;margin:6px 0}
      .ff-faq-tools button{width:28px;height:28px;border:1px solid #ccc;background:#fff;border-radius:6px;cursor:pointer}
      .ff-faq-add{margin:12px 0;background:#eef3ec;border:1px solid #cdddc9;border-radius:8px;padding:8px 14px;font:600 14px system-ui;cursor:pointer}
      .ff-edit-bar{position:fixed;left:0;right:0;bottom:0;z-index:9999;display:flex;align-items:center;justify-content:flex-end;gap:12px;background:#1f2a1f;color:#fff;padding:12px 20px;font:600 14px system-ui}
      .ff-edit-status{margin-right:auto;font-weight:500;opacity:.85}
      .ff-edit-save{background:#3F7D43;color:#fff;border:0;border-radius:8px;padding:9px 22px;font:600 14px system-ui;cursor:pointer}
      .ff-edit-save:disabled{opacity:.5;cursor:default}
      .ff-edit-exit{background:transparent;color:#fff;border:1px solid rgba(255,255,255,.4);border-radius:8px;padding:9px 16px;cursor:pointer}
      .ff-edit-toast{position:fixed;left:50%;bottom:72px;transform:translateX(-50%);z-index:10000;background:#1f2a1f;color:#fff;padding:10px 18px;border-radius:8px;font:600 14px system-ui}
      .ff-edit-note{position:fixed;top:0;left:0;right:0;z-index:10000;display:flex;align-items:center;gap:12px;background:#3F7D43;color:#fff;padding:10px 18px;font:500 13.5px/1.4 system-ui}
      .ff-edit-note b{font-weight:700}
      .ff-edit-note-x{margin-left:auto;flex:none;background:transparent;border:0;color:#fff;font-size:16px;line-height:1;cursor:pointer;opacity:.85}
      html.ff-note-on body{padding-top:56px}
      body{padding-bottom:64px}
    `;
    document.head.appendChild(s);
  }
}
boot();
