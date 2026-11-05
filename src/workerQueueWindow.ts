/** V2 trims the query and limits it to 120 Unicode code points. */
export function workerQueueSearch(value: string): string {
  return Array.from(value.trim()).slice(0, 120).join('');
}
