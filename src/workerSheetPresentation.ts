/** One native presenter stays owned until its dismissal animation actually finishes. */
export class WorkerSheetPresentation {
  private sequence = 0;
  private current: number | null = null;

  open(): number | null {
    if (this.current !== null) return null;
    this.current = ++this.sequence;
    return this.current;
  }

  isCurrent(id: number): boolean { return this.current === id; }

  isOpen(): boolean { return this.current !== null; }

  dismiss(id: number): boolean {
    if (!this.isCurrent(id)) return false;
    this.current = null;
    return true;
  }

  reset(): void { this.current = null; }
}
