export type WorkerSearchRowIndex<T> = readonly { row: T; text: string }[];

/** Keep baseline order while replacing overlapping rows with the latest server metadata. */
export function mergeWorkerSearchRows<T>(baseline: readonly T[] | null, current: readonly T[], key: (row: T, index: number) => string): readonly T[] {
  if (!baseline?.length || baseline === current) return current;
  const latest = new Map(current.map((row, index) => [key(row, index), row]));
  const seen = new Set<string>();
  const rows = baseline.map((row, index) => {
    const id = key(row, index);
    seen.add(id);
    return latest.get(id) ?? row;
  });
  current.forEach((row, index) => { if (!seen.has(key(row, index))) rows.push(row); });
  return rows;
}

export function indexWorkerSearchRows<T>(rows: readonly T[], text: (row: T) => string): WorkerSearchRowIndex<T> {
  return rows.map(row => ({ row, text: text(row).toLocaleLowerCase() }));
}

export function filterWorkerSearchRows<T>(index: WorkerSearchRowIndex<T>, query: string, limit: number): readonly T[] {
  const needle = query.toLocaleLowerCase();
  const rows: T[] = [];
  for (const entry of index) {
    if (needle && !entry.text.includes(needle)) continue;
    rows.push(entry.row);
    if (limit > 0 && rows.length >= limit) break;
  }
  return rows;
}
