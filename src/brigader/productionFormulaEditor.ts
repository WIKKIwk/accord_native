export const productionFormulaVariables = [{ label: 'Buyurtma miqdori', token: 'order_qty' }, { label: 'CPP kg', token: 'cpp_kg' }, { label: 'Natija kg', token: 'result_kg' }] as const;
export function productionFormulaDisplay(expression: string) { let text = expression; for (const variable of productionFormulaVariables)
    text = text.replace(new RegExp(`\\b${variable.token}\\b`, 'g'), variable.label); return text; }
export function productionFormulaInternal(expression: string) { let text = expression; for (const variable of productionFormulaVariables)
    text = text.replace(new RegExp(variable.label, 'gi'), variable.token); return text; }
export function productionFormulaSegment(text: string, cursor: number) { let start = Math.min(text.length, Math.max(0, cursor)); while (start > 0 && !'+-*/()<>!=&|,'.includes(text[start - 1]))
    start--; return start; }
export function productionFormulaSuggestion(text: string, cursor: number) { const prefix = text.slice(productionFormulaSegment(text, cursor), cursor).trim().toLowerCase(); return prefix.length < 2 ? null : productionFormulaVariables.find(variable => variable.label.toLowerCase().startsWith(prefix) || variable.token.toLowerCase().startsWith(prefix)) ?? null; }
export function productionFormulaInsert(text: string, cursor: number, variable: typeof productionFormulaVariables[number], space = false) { const start = productionFormulaSegment(text, cursor), insert = variable.label + (space ? ' ' : ''); return { text: text.slice(0, start) + insert + text.slice(Math.min(text.length, Math.max(0, cursor))), cursor: start + insert.length }; }
