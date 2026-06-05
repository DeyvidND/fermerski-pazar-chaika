// Backend stores money as integer cents (euro). Storefront shows "X,XX €".

/** Format integer euro-cents as euro, e.g. 650 -> "6,50 €". */
export function money(stotinki: number): string {
  return (stotinki / 100).toFixed(2).replace('.', ',') + ' €';
}

/** Format a euro amount (float) the same way — for client-side cart totals. */
export function moneyLv(lv: number): string {
  return lv.toFixed(2).replace('.', ',') + ' €';
}
