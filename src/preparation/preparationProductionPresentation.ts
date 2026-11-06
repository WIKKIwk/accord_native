import { preparationDisplay } from './preparationModel';
import type { preparationProductionBatchFromJson, preparationProductionOrderFromJson, preparationProductionRollFromJson } from './preparationProductionModel';

type Order = ReturnType<typeof preparationProductionOrderFromJson>;
type Batch = ReturnType<typeof preparationProductionBatchFromJson>;
type Roll = ReturnType<typeof preparationProductionRollFromJson>;

export function preparationProductionDate(raw: string) {
  const date = new Date(raw);
  if (!raw || Number.isNaN(date.getTime())) return raw || '—';
  const two = (value: number) => String(value).padStart(2, '0');
  return `${two(date.getDate())}.${two(date.getMonth() + 1)}.${date.getFullYear()} ${two(date.getHours())}:${two(date.getMinutes())}`;
}

export function preparationProductionMetrics(rolls: number, kg: string, length: string) {
  return `${rolls} ta rulon • ${preparationDisplay(kg)} kg • ${preparationDisplay(length)} m`;
}

export function preparationProductionOrderCard(order: Order) {
  return { title: `${order.order_code || order.order_id} • ${order.order_title}`,
    subtitle: [order.customer_name, `${order.batch_count} ta ishlab chiqarish`,
      order.active_batch_count > 0 ? `${order.active_batch_count} ta davom etmoqda` : '', preparationProductionDate(order.last_activity_at)].filter(Boolean).join(' • '),
    metrics: preparationProductionMetrics(order.roll_count, order.total_net_kg, order.total_length_m) };
}

export function preparationProductionBatchCard(batch: Batch) {
  return { title: batch.item_name || batch.item_code,
    subtitle: `${String(batch.preparation_formula?.variant_name ?? 'Formula qayd etilmagan')}\n${batch.active ? 'Davom etmoqda' : 'Yakunlangan'} • ${batch.warehouse} • ${preparationProductionDate(batch.last_activity_at)}`,
    metrics: preparationProductionMetrics(batch.roll_count, batch.total_net_kg, batch.total_length_m) };
}

export function preparationProductionRollCard(roll: Roll) {
  const metrics = [`${preparationDisplay(roll.net_kg)} kg`];
  if (roll.length_m !== null) metrics.push(`${preparationDisplay(roll.length_m)} m`);
  if (roll.width_mm !== null) metrics.push(`${preparationDisplay(roll.width_mm)} mm`);
  if (roll.micron !== null) metrics.push(`${preparationDisplay(roll.micron)} mkm`);
  return { title: roll.epc, subtitle: `${preparationProductionDate(roll.printed_at)} • ${roll.warehouse}`, metrics: metrics.join(' • ') };
}

export function preparationProductionRecipeLines(recipe: Readonly<Record<string, unknown>> | null) {
  if (!recipe || !Object.keys(recipe).length) return ['Formula qayd etilmagan'];
  const lines = [`Shnek formulasi: ${String(recipe.variant_name ?? '—')}`];
  if (recipe.variant_code != null) lines.push(`Formula kodi: ${String(recipe.variant_code)}`);
  lines.push(`Saqlangan tarkib • ${preparationProductionDate(String(recipe.captured_at ?? ''))}`);
  if (Array.isArray(recipe.formulas)) for (const value of recipe.formulas) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) continue;
    const screw = value as Record<string, unknown>;
    lines.push(`Shnek ${String(screw.name ?? 'null')} • ${preparationDisplay(String(screw.share_percent ?? '—'))}%`);
    if (Array.isArray(screw.lines)) for (const value of screw.lines) {
      if (!value || typeof value !== 'object' || Array.isArray(value)) continue;
      const line = value as Record<string, unknown>;
      lines.push(`${String(line.name ?? line.item_code ?? 'null')} — ${preparationDisplay(String(line.percent ?? '—'))}%`);
    }
  }
  return lines;
}
