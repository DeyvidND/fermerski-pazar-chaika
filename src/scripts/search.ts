// Shared client wiring for the storefront search bars (SearchBar.astro).
// The page owns the actual filtering via the `onQuery` callback; this helper
// only normalizes input, drives the clear button, and handles Escape-to-clear.

// Debounce delay for the `onQuery` call on every keystroke — the page's
// apply() loops every card and reflows on each call, so firing it per
// keystroke is wasteful on a long catalog. 130ms is short enough to still
// feel instant while collapsing fast typing into one filter pass.
const QUERY_DEBOUNCE_MS = 130;

function normalize(v: string): string {
  return v.trim().toLocaleLowerCase('bg');
}

export function wireSearch(inputId: string, onQuery: (q: string) => void): void {
  const input = document.getElementById(inputId) as HTMLInputElement | null;
  if (!input) return;
  const bar = input.closest('.searchbar');
  const clear = bar?.querySelector<HTMLButtonElement>('.searchbar__clear') ?? null;

  let debounceTimer: ReturnType<typeof setTimeout> | undefined;
  const runNow = () => {
    if (debounceTimer !== undefined) {
      clearTimeout(debounceTimer);
      debounceTimer = undefined;
    }
    if (clear) clear.hidden = input.value.length === 0;
    onQuery(normalize(input.value));
  };

  input.addEventListener('input', () => {
    // The clear-button toggle stays immediate so the ✕ never lags a keystroke;
    // only the (expensive) onQuery filter pass is debounced.
    if (clear) clear.hidden = input.value.length === 0;
    if (debounceTimer !== undefined) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      debounceTimer = undefined;
      onQuery(normalize(input.value));
    }, QUERY_DEBOUNCE_MS);
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && input.value) {
      e.preventDefault();
      input.value = '';
      runNow();
    }
  });
  clear?.addEventListener('click', () => {
    input.value = '';
    runNow();
    input.focus();
  });
}
