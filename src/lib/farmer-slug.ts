// Farmer profile URLs use a latin, SEO-friendly slug derived from the farmer's
// name (`/farmer/<name-slug>`), matching the transliterated product slugs
// (e.g. "yagodi") already coming from the backend. The backend `Farmer` type
// has no slug field, so it's derived here, purely from `name`, and kept
// consistent between link generation and route resolution via the same
// collision-aware map (see `farmerSlugMap`).
import type { Farmer } from './types';

/** Bulgarian Cyrillic → Latin transliteration table (both cases). Unmapped
 *  characters (Latin letters, digits, punctuation, spaces) pass through
 *  unchanged and get cleaned up by `slugify` below. */
const BG_LATIN: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ж: 'zh', з: 'z', и: 'i',
  й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's',
  т: 't', у: 'u', ф: 'f', х: 'h', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'sht',
  ъ: 'a', ь: 'y', ю: 'yu', я: 'ya',
  А: 'a', Б: 'b', В: 'v', Г: 'g', Д: 'd', Е: 'e', Ж: 'zh', З: 'z', И: 'i',
  Й: 'y', К: 'k', Л: 'l', М: 'm', Н: 'n', О: 'o', П: 'p', Р: 'r', С: 's',
  Т: 't', У: 'u', Ф: 'f', Х: 'h', Ц: 'ts', Ч: 'ch', Ш: 'sh', Щ: 'sht',
  Ъ: 'a', Ь: 'y', Ю: 'yu', Я: 'ya',
};

/** Transliterate Cyrillic → Latin, then slugify: lowercase, non [a-z0-9]
 *  runs collapse to a single `-`, leading/trailing dashes trimmed. Pure
 *  name-based — does not account for farmers sharing an identical name; use
 *  `farmerSlugMap`/`farmerHref`/`resolveFarmer` for that. */
export function farmerSlug(name: string): string {
  const translit = Array.from(name)
    .map((ch) => BG_LATIN[ch] ?? ch)
    .join('');
  return translit
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** UUID-ish id, matching how farmer ids look coming off the backend. Loose on
 *  purpose (not a strict RFC4122 check) — only used to decide whether an
 *  unresolved `/farmer/<param>` looks like an old id-based link worth a 301,
 *  not to validate the id. */
const UUID_RE = /^[0-9a-f-]{36}$/i;

/** id → public slug for every farmer in `farmers`, collision-safe: when two+
 *  farmers slugify to the same base (e.g. two "Иван Иванов"), the first one
 *  (in list order) keeps the plain slug and each subsequent one gets a
 *  `-<first6ofId>` suffix appended. With the roster capped at a few dozen
 *  farmers this is rare and the suffix keeps URLs deterministic and stable
 *  across renders. Both `farmerHref` and `resolveFarmer` build off this same
 *  map, so link generation and route resolution never disagree. */
export function farmerSlugMap(farmers: Farmer[]): Map<string, string> {
  const byBase = new Map<string, Farmer[]>();
  for (const f of farmers) {
    const base = farmerSlug(f.name);
    const group = byBase.get(base);
    if (group) group.push(f);
    else byBase.set(base, [f]);
  }
  const out = new Map<string, string>();
  for (const group of byBase.values()) {
    group.forEach((f, i) => {
      out.set(f.id, i === 0 ? farmerSlug(f.name) : `${farmerSlug(f.name)}-${f.id.slice(0, 6)}`);
    });
  }
  return out;
}

/** The public `/farmer/<slug>` href for one farmer, collision-safe against the
 *  full roster. Pass the full farmer list (not a filtered subset) so the
 *  slug a card links to always matches what `resolveFarmer` expects. */
export function farmerHref(farmers: Farmer[], farmer: Farmer): string {
  const slug = farmerSlugMap(farmers).get(farmer.id) ?? farmerSlug(farmer.name);
  return `/farmer/${slug}`;
}

export interface ResolvedFarmer {
  farmer: Farmer | null;
  /** The slug this farmer's page should be considered canonical at. Null when
   *  no farmer was found at all. */
  canonicalSlug: string | null;
  /** True when `param` didn't match a slug but matched a farmer by (old) uuid
   *  — the page should 301 to `canonicalSlug`. */
  needsRedirect: boolean;
}

/** Resolves a `/farmer/<param>` route param to a farmer. `param` is normally
 *  the current slug (`farmerSlugMap`-derived) and resolves directly; when it
 *  instead looks like a bare farmer uuid (an old pre-slug link), falls back
 *  to an id lookup and asks the caller to 301 to the canonical slug so old
 *  links keep working without losing SEO equity. */
export function resolveFarmer(farmers: Farmer[], param: string | undefined | null): ResolvedFarmer {
  if (!param) return { farmer: null, canonicalSlug: null, needsRedirect: false };
  const slugs = farmerSlugMap(farmers);
  const bySlug = farmers.find((f) => slugs.get(f.id) === param);
  if (bySlug) {
    return { farmer: bySlug, canonicalSlug: slugs.get(bySlug.id) ?? farmerSlug(bySlug.name), needsRedirect: false };
  }
  if (UUID_RE.test(param)) {
    const byId = farmers.find((f) => f.id === param);
    if (byId) {
      return { farmer: byId, canonicalSlug: slugs.get(byId.id) ?? farmerSlug(byId.name), needsRedirect: true };
    }
  }
  return { farmer: null, canonicalSlug: null, needsRedirect: false };
}
