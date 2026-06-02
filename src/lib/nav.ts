// Storefront navigation. The Фермери link only appears when the farm runs in
// multi-farmer mode (tenant.multiFarmer) — matching the backend gating.
export interface NavLink {
  label: string;
  href: string;
}

export function navLinks(multiFarmer: boolean): NavLink[] {
  return [
    { label: 'Начало', href: '/' },
    ...(multiFarmer ? [{ label: 'Фермери', href: '/farmers' }] : []),
    { label: 'Магазин', href: '/shop' },
    { label: 'Поръчки', href: '/orders' },
    { label: 'За нас', href: '/about' },
    { label: 'Отзиви', href: '/reviews' },
    { label: 'Контакти', href: '/contact' },
  ];
}

/** Active when the current path equals the link, or is nested under it. */
export function isActive(pathname: string, href: string): boolean {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(href + '/');
}
