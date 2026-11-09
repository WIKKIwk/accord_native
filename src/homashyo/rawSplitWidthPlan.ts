import { RawSplitFormatException, rawSplitQuantity } from './rawSplitModel';
/** @v2 rawSplitMinimumWidth */
export const rawSplitMinimumWidth = 355000000n;
/** @v2 RawSplitWidthPlan */
export class RawSplitWidthPlan {
  readonly source: bigint; readonly widths: (bigint | null)[] = []; readonly errors: (string | null)[] = [];
  readonly remaining: bigint;
  constructor(sourceWidth: string, inputs: readonly string[]) {
    this.source = rawSplitQuantity(sourceWidth);
    for (const input of inputs) {
      let width: bigint | null = null, error: string | null = null;
      if (input.trim()) {
        try { width = rawSplitQuantity(input); if (width < rawSplitMinimumWidth) error = 'Eni kamida 355 mm bo‘lsin'; }
        catch { error = 'Enni to‘g‘ri kiriting'; }
      }
      this.widths.push(width); this.errors.push(error);
    }
    this.remaining = this.source - this.widths.reduce<bigint>((sum, width) => sum + (width ?? 0n), 0n);
    if (this.remaining < 0n) this.widths.forEach((width, i) => {
      if (width !== null && this.errors[i] === null) this.errors[i] = 'Enlar yig‘indisi asl endan oshdi';
    });
  }
  get valid(): boolean { return this.errors.every(error => error === null); }
  get complete(): boolean { return this.valid && this.widths.length > 0 && !this.widths.includes(null); }
  get canAdd(): boolean { return this.complete && this.remaining >= rawSplitMinimumWidth && this.widths.length < 100; }
  get maxRolls(): number { const count = this.source / rawSplitMinimumWidth; return Number(count > 100n ? 100n : count); }
  validateForSave(): void {
    for (const error of this.errors) if (error !== null) throw new RawSplitFormatException(error);
    if (!this.complete) throw new RawSplitFormatException('Har bir rulon enini kiriting');
    if (this.remaining >= rawSplitMinimumWidth) throw new RawSplitFormatException('Qolgan yaroqli en uchun ham rulon kiriting');
  }
}
