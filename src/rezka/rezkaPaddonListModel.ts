import type { RezkaPaddonListState } from './rezkaPaddonListController';
import type { RezkaSessionSnapshot } from './rezkaSessionGuard';

type Text = (key: string, values?: Record<string, unknown>) => string;
export type RezkaPaddonReadOnlyProps = { snapshot: RezkaSessionSnapshot; apparatusId?: string; apparatusName?: string;
  navigation?: { icon: 'menu' | 'back'; label: string; onPress(): void } | null };

export function rezkaPaddonListContent(state: RezkaPaddonListState, t: Text, retry: string) {
  const { scope } = state;
  const title = scope.apparatusName ? t('worker.paddon.apparatus', { apparatus: scope.apparatusName }) : t('worker.paddons');
  return { title, subtitle: t('worker.paddon.subtitle'), loadFailed: t('worker.paddon.load_failed'), retry,
    options: state.options.map(item => ({ id: item.id, title: t('worker.paddon.apparatus', { apparatus: item.name }) })),
    summaryTitle: t('worker.paddon.location.title'), summarySubtitle: t('worker.paddon.location.subtitle'),
    paddonMetric: `${t('worker.paddons')}: ${state.paddonCount}`, wipMetric: `${t('worker.daily.wip')}: ${state.wipCount}`,
    emptyTitle: t('worker.paddon.empty.title'), emptyBody: t('worker.paddon.empty.body'),
    rows: state.paddons.map(row => ({ code: row.code, count: t('worker.paddon.wip_count', { count: row.item_count }),
      subtitle: row.contains_peremotka ? t('worker.rezka.print.peremotka') : '' })) };
}
