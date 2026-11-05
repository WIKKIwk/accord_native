export type ProductionMapLiveOptions = {
  delta?: boolean; stateDelta?: boolean; compactStateDelta?: boolean; paged?: boolean; workerScope?: boolean;
  pageWindows?: Record<string, unknown>[]; notificationsOnly?: boolean; epoch?: string; revision?: number | null;
  scope?: string; queueLimit?: number | null; queueSearch?: string;
};

/** @v2 adminProductionMapLiveUri */
export function adminProductionMapLiveUri(baseUrl: string, token: string, options: ProductionMapLiveOptions = {}): URL {
  const normalizedToken = token.trim();
  if (!normalizedToken) throw new Error('No session token');
  const url = new URL(baseUrl);
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  url.pathname = '/v1/mobile/admin/production-maps/live';
  url.search = '';
  url.searchParams.set('token', normalizedToken);
  const { notificationsOnly = false, pageWindows = [], stateDelta = false, compactStateDelta = true,
    workerScope = true, delta = false, paged = false, epoch = '', scope = '', revision,
    queueLimit, queueSearch = '' } = options;
  if (notificationsOnly) {
    url.searchParams.set('protocol', 'notifications_v1');
  } else if (pageWindows.length) {
    url.searchParams.set('protocol', 'page_delta_v1');
    url.searchParams.set('pages', JSON.stringify(pageWindows));
  } else if (stateDelta) {
    url.searchParams.set('protocol', compactStateDelta ? 'state_delta_v2' : 'state_delta_v1');
    url.searchParams.set('worker_scope', String(workerScope));
    if (workerScope && compactStateDelta) url.searchParams.set('projection', 'worker_list_v1');
    if (queueLimit != null) {
      url.searchParams.set('queue_limit', String(queueLimit));
      if (workerScope) url.searchParams.set('queue_positions', 'true');
    }
    if (queueSearch.trim()) url.searchParams.set('queue_search', queueSearch.trim());
    url.searchParams.set('epoch', epoch);
    url.searchParams.set('scope', scope);
    if (revision != null) url.searchParams.set('rev', String(revision));
  } else if (delta) {
    url.searchParams.set('protocol', 'delta');
    if (paged) url.searchParams.set('paged', 'true');
  }
  return url;
}
