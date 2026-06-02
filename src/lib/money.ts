// Backend stores money as integer stotinki. Storefront shows "X,XX лв".

/** Format integer stotinki as Bulgarian leva, e.g. 650 -> "6,50 лв". */
export function money(stotinki: number): string {
  return (stotinki / 100).toFixed(2).replace('.', ',') + ' лв';
}

/** Format a leva amount (float) the same way — for client-side cart totals. */
export function moneyLv(lv: number): string {
  return lv.toFixed(2).replace('.', ',') + ' лв';
}
