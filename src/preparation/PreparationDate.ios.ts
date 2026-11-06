export function preparationJournalDate(raw: string): string {
  const date = new Date(raw);
  if (!raw || Number.isNaN(date.getTime())) return raw || '—';
  const two = (value: number) => String(value).padStart(2, '0');
  return `${two(date.getDate())}.${two(date.getMonth() + 1)}.${date.getFullYear()} ${two(date.getHours())}:${two(date.getMinutes())}`;
}
