// Shapes the flat backend data into the storefront's
// farmer -> category -> product structure. Categories come from the tenant's
// subcategories when multiSubcat is on; otherwise they fall back to the
// free-text product.category field so a single-section farm still groups well.
import type { Product, Subcategory, CoverCrop } from './types';
import { iconForCategory } from './icons';

export interface Category {
  id: string;
  name: string;
  desc: string;
  icon: string;
  imageUrl: string | null;
  /** Cover framing for the category photo (from the subcategory); null = centred. */
  coverCrop: CoverCrop | null;
  count: number;
}

const BUNDLE_LABEL = 'Кошници';
const catLabel = (raw: string) => (raw === 'bundle' ? BUNDLE_LABEL : raw);

/** The grouping key for a product under the active taxonomy. */
export function catIdOf(p: Product, multiSubcat: boolean): string {
  return (multiSubcat ? p.subcategoryId : p.category) || '';
}

/** Build the category list for the active taxonomy, with live product counts. */
export function categoriesFrom(
  products: Product[],
  subcats: Subcategory[],
  multiSubcat: boolean,
): Category[] {
  if (multiSubcat && subcats.length) {
    return subcats.map((s) => ({
      id: s.id,
      name: s.name,
      desc: s.description || 'Продукти от тази категория, директно от фермера.',
      icon: iconForCategory(s.name),
      imageUrl: s.imageUrl,
      coverCrop: s.coverCrop ?? null,
      count: products.filter((p) => p.subcategoryId === s.id).length,
    }));
  }
  // Free-text fallback — distinct product.category, preserving first-seen order.
  const seen = new Map<string, number>();
  for (const p of products) {
    const key = p.category || '';
    if (!key) continue;
    seen.set(key, (seen.get(key) || 0) + 1);
  }
  return [...seen.entries()].map(([id, count]) => ({
    id,
    name: catLabel(id),
    desc:
      id === 'bundle'
        ? 'Готови кошници с продукти от няколко фермери, на обща цена.'
        : 'Свежи продукти от местните фермери.',
    icon: iconForCategory(catLabel(id)),
    imageUrl: null,
    coverCrop: null,
    count,
  }));
}

/** Featured first (admin ★), then newest, capped at n. */
export function featured(products: Product[], n: number): Product[] {
  const active = products.filter((p) => p.isActive !== false);
  const stars = active.filter((p) => p.featured);
  const rest = active.filter((p) => !p.featured);
  return [...stars, ...rest].slice(0, n);
}

/** A farmer's products grouped into their categories — the farmer subsections. */
export function farmerSubsections(
  farmerId: string,
  products: Product[],
  cats: Category[],
  multiSubcat: boolean,
): { cat: Category; products: Product[] }[] {
  const mine = products.filter((p) => p.farmerId === farmerId && p.isActive !== false);
  const out: { cat: Category; products: Product[] }[] = [];
  for (const cat of cats) {
    const inCat = mine.filter((p) => catIdOf(p, multiSubcat) === cat.id);
    if (inCat.length) out.push({ cat, products: inCat });
  }
  // Any of the farmer's products that don't match a known category.
  const grouped = new Set(out.flatMap((s) => s.products.map((p) => p.id)));
  const leftover = mine.filter((p) => !grouped.has(p.id));
  if (leftover.length) {
    out.push({
      cat: { id: 'other', name: 'Други продукти', desc: '', icon: 'berry', imageUrl: null, coverCrop: null, count: leftover.length },
      products: leftover,
    });
  }
  return out;
}
