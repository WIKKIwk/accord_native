/** Dart interpolates these fields as doubles, including `.0` on finite whole values below 1e21. */
export function adminDartDouble(value: number): string {
  return Number.isInteger(value) && Math.abs(value) < 1e21 ? `${Object.is(value, -0) ? '-0' : value}.0` : String(value);
}
