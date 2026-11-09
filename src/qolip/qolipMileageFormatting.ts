import { parseDartDateTime } from './qolipApiCommon';

/** @v2 qolipReworkDate */
export function qolipReworkDate(value: string): string {
  const date = parseDartDateTime(value);
  if (!date) return value;
  const two = (n: number) => String(n).padStart(2, '0');
  return `${two(date.getDate())}.${two(date.getMonth() + 1)}.${date.getFullYear()} ${two(date.getHours())}:${two(date.getMinutes())}`;
}

/** @v2 qolipMileageMeter */
export function qolipMileageMeter(value: number): string {
  const fixed = Object.is(value, -0) ? '-0.00' : value.toFixed(2);
  return fixed.replace(/\.?0+$/, '');
}
