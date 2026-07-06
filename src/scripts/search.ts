// Shared client wiring for the storefront search bars (SearchBar.astro).
// The page owns the actual filtering via the `onQuery` callback; this helper
// only normalizes input, drives the clear button, and handles Escape-to-clear.

function normalize(v: string): string {
  return v.trim().toLocaleLowerCase('bg');
}

export function wireSearch(inputId: string, onQuery: (q: string) => void): void {
  const input = document.getElementById(inputId) as HTMLInputElement | null;
  if (!input) return;
  const bar = input.closest('.searchbar');
  const clear = bar?.querySelector<HTMLButtonElement>('.searchbar__clear') ?? null;

  const run = () => {
    if (clear) clear.hidden = input.value.length === 0;
    onQuery(normalize(input.value));
  };

  input.addEventListener('input', run);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && input.value) {
      e.preventDefault();
      input.value = '';
      run();
    }
  });
  clear?.addEventListener('click', () => {
    input.value = '';
    run();
    input.focus();
  });
}
