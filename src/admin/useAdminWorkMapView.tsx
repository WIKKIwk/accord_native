import { router, type Href } from 'expo-router';
import { useCallback, useState, useSyncExternalStore } from 'react';
import { Platform } from 'react-native';
import { useNativeSheet } from '../nativeSheet';
import { appRoutes } from '../shared/appRoutes';
import { adminText, productionText } from '../shared/localization';
import { localeController } from '../shared/localization/runtime';
import { AdminWorkMapDetail } from './AdminWorkMapDetail';
import { adminWorkMapClosedRows } from './adminWorkMapClosedModel';
import { adminWorkMapAuditPresentation } from './adminWorkMapAuditPresentation';
import type { AdminWorkMapModule, AdminWorkMapRow } from './adminWorkMapController';
import { useAdminShell } from './AdminShellContext';
import { useAdminWorkMap } from './useAdminWorkMap';
const subscribeLocale = (listener: () => void) => localeController.addListener(listener);
const localeNow = () => localeController.locale;
export function useAdminWorkMapView() {
  const shell = useAdminShell(), locale = useSyncExternalStore(subscribeLocale, localeNow, localeNow), sheet = useNativeSheet();
  const { state, controller, workspace, workspaceState } = useAdminWorkMap(shell.session, shell.isCurrent), [query, setQuery] = useState('');
  const [filterExpanded, setFilterExpanded] = useState(false);
  const goBack = useCallback(() => { if (router.canGoBack()) router.back(); else router.replace(`/${Platform.OS}-admin` as Href); }, []);
  const onProfile = useCallback(() => {
    const path = shell.isCurrent() ? shell.destination(appRoutes.profile, Platform.OS) : null;
    if (path) router.push(path as Href);
  }, [shell]);
  const search = (value: string) => { setQuery(value); controller.setQuery(value); };
  const open = (row: AdminWorkMapRow) => {
    if (!shell.isCurrent() || !shell.destination(appRoutes.adminProductionMapOrders, Platform.OS)) return;
    const ticket = controller.detailTicket(row); if (!ticket) return;
    sheet.open(<AdminWorkMapDetail session={shell.session} isCurrent={shell.isCurrent} controller={controller} row={row} ticket={ticket} close={sheet.close} />,
      { dismissible: row.kind !== 'order' });
  };
  const controls = { module: workspaceState.module, catalog: workspaceState.catalog, selected: workspaceState.selected, expanded: filterExpanded,
    onToggle: () => setFilterExpanded(value => !value),
    onModule: (value: AdminWorkMapModule) => { if (shell.isCurrent()) { sheet.close(); workspace.selectModule(value); setFilterExpanded(false); } },
    onApparatus: (id: string) => { if (shell.isCurrent()) { sheet.close(); workspace.selectApparatus(id); setFilterExpanded(false); } },
    apparatusLabel: productionText('worker.queue.filter.apparatus', locale), unselectedLabel: productionText('worker.queue.filter.unselected', locale),
    countText: workspaceState.module === 'sequence' && state.total > 0 ? productionText('worker.queue.orders_count', locale, { count: state.total }) : '' };
  const error = state.error ?? (workspaceState.module === 'sequence' ? workspaceState.catalogError : null);
  const loading = state.loading || (workspaceState.module === 'sequence' && workspaceState.catalogLoading);
  const emptyText = workspaceState.module === 'sequence'
    ? !workspaceState.catalogLoaded || loading ? '' : workspaceState.selected == null
      ? productionText('worker.queue.empty.select_apparatus', locale)
      : state.loaded && !state.rows.length ? productionText('worker.queue.empty.for_apparatus', locale, { apparatus: workspaceState.selected.name.trim() }) : ''
    : workspaceState.module === 'closed' ? state.loaded && !loading && !state.closed.length ? adminText('production.closed_empty', locale) : ''
    : workspaceState.module === 'orders' && state.loaded && !loading && !state.rows.length ? adminText(state.query ? 'production.search_empty' : 'production.open_empty', locale) : '';
  return { shell, locale, state, controller, controls, error, loading, emptyText, closed: adminWorkMapClosedRows(state.closed ?? []), audit: adminWorkMapAuditPresentation(state.audit ?? null, error, loading, locale), refresh: () => workspace.reload(), query, goBack, onProfile, search, open };
}
