type BobinaItem = { bobina_kg: number | null };

/** @v2 _paddonBobinaWeightUnits */
export function rezkaPaddonBobinaUnits(kg: number | null): number {
  if (kg == null || !Number.isFinite(kg) || kg <= 0) return 0;
  const units = Math.round(kg * 1_000_000);
  // JS cannot reliably distinguish adjacent integer micro-kilograms beyond this bound.
  if (!Number.isSafeInteger(units)) throw new RangeError();
  return units > 0 ? units : 0;
}

/** Groups assigned physical WIPs by six-decimal bobina weight; unknown comes last. */
export function rezkaPaddonBobinaGroups(items: readonly BobinaItem[]) {
  const counts = new Map<number, number>();
  for (const item of items) {
    const units = rezkaPaddonBobinaUnits(item.bobina_kg);
    counts.set(units, (counts.get(units) ?? 0) + 1);
  }
  const weights = [...counts.keys()].filter(units => units > 0).sort((a, b) => a - b);
  if (counts.has(0)) weights.push(0);
  return weights.map(units => ({ units, count: counts.get(units)! }));
}

/** Formats known integer micro-kilogram groups without another floating-point rounding step. */
export function rezkaPaddonBobinaLabel(units: number): string {
  if (!Number.isSafeInteger(units) || units <= 0) throw new RangeError();
  const whole = Math.floor(units / 1_000_000), fraction = units % 1_000_000;
  return `${whole}${fraction ? `.${String(fraction).padStart(6, '0').replace(/0+$/, '')}` : ''} kg`;
}

export function rezkaPaddonVisibleWips<T extends BobinaItem>(items: readonly T[], selectedUnits: number | null): T[] {
  return selectedUnits == null ? [...items] : items.filter(item => rezkaPaddonBobinaUnits(item.bobina_kg) === selectedUnits);
}

/** Changing or clearing the filter also clears both add/remove selections in V2. */
export function nextRezkaPaddonBobinaFilter(current: number | null, tapped: number) {
  return { selectedUnits: current === tapped ? null : tapped, selectedAvailableIds: [] as string[], selectedAssignedIds: [] as string[] };
}
