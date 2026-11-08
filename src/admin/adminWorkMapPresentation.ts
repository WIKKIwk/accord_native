import { productionText } from '../shared/localization';
import { workerOrderTone } from '../workerOrderAppearance';
import type { AdminWorkMapRow } from './adminWorkMapController';
import { adminWorkMapText } from './adminWorkMapText';
export function adminWorkMapPresentation(row: AdminWorkMapRow, locale: string) {
  const kg = row.kg ?? 0;
  const kgText = Number.isInteger(kg) && Math.abs(kg) < 1e21 ? `${Object.is(kg, -0) ? '-0' : kg}.0` : String(kg);
  const title = row.title.trim() || productionText('worker.order.fallback', locale);
  return { headline: [row.code, title].filter(Boolean).join(' • '),
    supporting: row.kind === 'pending' ? `${row.customer} · ${kgText} kg · ${adminWorkMapText(locale).pending}` : row.customer,
    tone: workerOrderTone(row.displayState, '', '') };
}
