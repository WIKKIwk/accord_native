import type { preparationPendingCommand } from './preparationCommandApi';

export function preparationPendingLabel(pending: NonNullable<Awaited<ReturnType<typeof preparationPendingCommand>>>) {
  if (pending.kind === 'receipts') return `Kirim: ${String(pending.payload.kg ?? '')} kg`;
  if (pending.kind === 'materials') return `Homashyo: ${String(pending.payload.name ?? '')}`;
  return `Order: ${String(pending.payload.order_id ?? '')}`;
}
