import { productionText } from '../shared/localization';
import { workerOrderTone } from '../workerOrderAppearance';
import type { AdminWorkMapRow } from './adminWorkMapController';
import { adminWorkMapText } from './adminWorkMapText';
import { adminDartDouble } from './adminDartDouble';
export function adminWorkMapPresentation(row: AdminWorkMapRow, locale: string) {
  const kg = row.kg ?? 0;
  const kgText = adminDartDouble(kg);
  const title = row.kind === 'pending' ? row.title : row.title.trim() || productionText('worker.order.fallback', locale);
  const headline = row.kind === 'pending' ? `${row.code} • ${title}`
    : `${row.position == null ? '' : `${row.position}. `}${[row.code, title].filter(Boolean).join(' • ')}`;
  return { headline,
    supporting: row.kind === 'pending' ? `${row.customer} · ${kgText} kg · ${adminWorkMapText(locale).pending}` : row.customer,
    tone: workerOrderTone(row.displayState, '', '') };
}
