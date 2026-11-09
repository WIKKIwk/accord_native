import { productionText } from '../shared/localization';
import { workerOrderTone } from '../workerOrderAppearance';
import type { AdminWorkMapRow } from './adminWorkMapController';
import { adminWorkMapText } from './adminWorkMapText';
import { adminDartDouble } from './adminDartDouble';
import { dartTrim } from './dartJsonString';
export function adminWorkMapPresentation(row: AdminWorkMapRow, locale: string) {
  const kg = row.kg ?? 0;
  const kgText = adminDartDouble(kg);
  const title = row.kind === 'pending' ? row.title : (row.opened ? dartTrim(row.title) : row.title.trim()) || productionText('worker.order.fallback', locale);
  const headline = row.kind === 'pending' ? `${row.code} • ${title}`
    : `${row.position == null ? '' : `${row.position}. `}${[row.code, title].filter(Boolean).join(' • ')}`;
  const openedSupporting = row.opened && [row.opened.secondary, row.opened.apparatusCount > 0
    ? productionText('worker.queue.apparatus_count', locale, { count: row.opened.apparatusCount }) : ''].filter(Boolean).join(' • ');
  return { headline,
    supporting: row.kind === 'pending' ? `${row.customer} · ${kgText} kg · ${adminWorkMapText(locale).pending}` : openedSupporting ?? row.customer,
    tone: workerOrderTone(row.displayState, '', '') };
}
