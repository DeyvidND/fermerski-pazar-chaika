// Backend stores money as integer cents (euro). Storefront shows "X,XX €".
import { bgnHtml } from './currency';

/** Format integer euro-cents as euro + BGN (legally required dual pricing), e.g. 650 -> "6,50 € <span ...>(12,71 лв.)</span>". */
export function money(stotinki: number): string {
  const eur = stotinki / 100;
  return eur.toFixed(2).replace('.', ',') + ' €' + bgnHtml(eur);
}

/** Format a euro amount (float) the same way — for client-side cart totals. */
export function moneyLv(lv: number): string {
  return lv.toFixed(2).replace('.', ',') + ' €' + bgnHtml(lv);
}

/** EUR-only, no BGN suffix — for crossed-out "was" prices, which aren't the price actually charged. */
export function moneyEurOnly(stotinki: number): string {
  return (stotinki / 100).toFixed(2).replace('.', ',') + ' €';
}
