type Variant = { name: string; formula_code: string; formula_count: number; shares_complete: boolean };

export function preparationVariantSubtitle(variant: Variant) {
  const description = variant.formula_count === 0 ? 'Tarkib hali kiritilmagan'
    : `${variant.formula_count} ta ichki formula • ${variant.shares_complete ? 'jami 100%' : 'ulushlar belgilanmagan'}`;
  return [variant.formula_code, description].filter(Boolean).join(' • ');
}

export function preparationVariantRemoveMessage(name: string, orderCode: string) {
  return `${name} shnek formulasi ${orderCode} buyurtmasidan olib tashlanadi.`;
}

export function preparationVariantRemovedMessage(name: string) {
  return `${name} buyurtmadan olib tashlandi`;
}
