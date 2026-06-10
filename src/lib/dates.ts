export function formatDateBg(iso: string | null | undefined): string {
  if (!iso) return '';
  return new Intl.DateTimeFormat('bg-BG', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(iso));
}
