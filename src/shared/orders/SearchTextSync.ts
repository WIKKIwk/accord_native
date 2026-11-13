/** React acknowledges native edits later; an acknowledgement must never rewrite newer typing. */
export class SearchTextSync {
  private pending: string[] = [];

  constructor(private prop: string) {}

  nativeChanged(value: string) {
    this.pending.push(value);
  }

  /** True only for a programmatic change, rather than an echo of native input. */
  reactChanged(value: string): boolean {
    if (value === this.prop) return false;
    this.prop = value;
    const acknowledged = this.pending.indexOf(value);
    if (acknowledged >= 0) {
      this.pending.splice(0, acknowledged + 1);
      return false;
    }
    this.pending = [];
    return true;
  }
}
