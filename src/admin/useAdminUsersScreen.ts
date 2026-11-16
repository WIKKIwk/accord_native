import { useIsFocused } from 'expo-router';
import { useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import { adminText, localizedGetter } from '../shared/localization';
import { localeController } from '../shared/localization/runtime';
import type { AdminUsersScreenProps, AdminUsersRow } from './AdminUsersScreenTypes';
import { adminUserKindLabel, adminUserKinds, adminUserRoleLabel, adminUsersShowFooter } from './adminUsersModel';
import { dartTrim } from './dartJsonString';
import { useAdminUsers } from './useAdminUsers';
import { isSynchronouslyTrue } from '../shared/camera/synchronousGuard';
import { useAdminOwnedBack } from './AdminOwnedBackContext';

const subscribeLocale = (listener: () => void) => localeController.addListener(listener);
const getLocale = () => localeController.locale;

/** Keep route focus separate from the original session witness: returning from a detail still reloads the same owner. */
export function useAdminUsersScreen(props: AdminUsersScreenProps) {
  const { state, controller, isCurrent } = useAdminUsers(props.session, props.witness, props.isCurrent);
  const locale = useSyncExternalStore(subscribeLocale, getLocale, getLocale), focused = useIsFocused();
  const focus = useRef(focused), mounted = useRef(false), generation = controller.interactionGeneration();
  useLayoutEffect(() => { focus.current = focused; return () => { focus.current = false; }; }, [focused]);
  useLayoutEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, [controller]);
  const [search, setSearch] = useState({ controller, generation, text: state.query, edited: false });
  const [searchFocus, setSearchFocus] = useState({ controller, generation, value: false });
  const [refresh, setRefresh] = useState({ controller, generation, active: false });
  const pendingOpen = useRef<{ controller: typeof controller; generation: number; marker: object } | null>(null);
  const lifetimeCurrent = () => mounted.current && controller.isInteractionCurrent(generation) && isCurrent();
  const interactive = () => focus.current && lifetimeCurrent() && (props.canInteract === undefined || isSynchronouslyTrue(props.canInteract)) && lifetimeCurrent();
  const a = (key: string) => adminText(key, locale), t = (key: string) => localizedGetter(key, locale);
  const items = controller.visibleItems(locale), occurrences = new Map<string, number>();
  const searchText = search.controller === controller && search.generation === generation && search.edited ? search.text : state.query;
  const rows: readonly AdminUsersRow[] = items.map((item, index) => {
    const occurrence = occurrences.get(item.id) ?? 0; occurrences.set(item.id, occurrence + 1);
    return { key: `${item.id}:${occurrence}`, id: item.id, index, count: items.length, title: item.name,
      subtitle: [adminUserRoleLabel(item), ...(item.blocked ? ['Blocked'] : []), ...(dartTrim(item.phone) ? [dartTrim(item.phone)] : [])].join(' • '),
      revision: `${item.name}:${item.phone}:${adminUserRoleLabel(item)}:${item.blocked}`,
      entering: state.enteringIds.includes(item.id), exiting: state.exitingItems.some(exiting => exiting.id === item.id) };
  });
  const reload = async () => {
    if (!interactive()) return;
    setRefresh({ controller, generation, active: true });
    try { await controller.refresh(); }
    finally { if (lifetimeCurrent()) setRefresh({ controller, generation, active: false }); }
  };
  const openUser = async (id: string) => {
    if (!interactive() || (pendingOpen.current?.controller === controller && pendingOpen.current.generation === generation)) return;
    const ticket = controller.captureDetail(id, locale); if (!ticket) return;
    const marker = {}; pendingOpen.current = { controller, generation, marker };
    try {
      const changed = await props.onOpenUser(ticket, { isCurrent: lifetimeCurrent, canInteract: interactive });
      // Native focus may be restored after the awaited navigation result. Session/lifetime authority still applies.
      if (lifetimeCurrent()) controller.completeDetail(ticket, changed);
    } catch { controller.completeDetail(ticket, false); }
    finally { if (pendingOpen.current?.marker === marker) pendingOpen.current = null; }
  };
  const back = () => { if (interactive()) props.onBack(); };
  useAdminOwnedBack(back);
  return { state, rows, generation, identity: controller, focused, locale, a, t,
    searchText, hasSearchText: dartTrim(searchText).length > 0,
    searchFocused: searchFocus.controller === controller && searchFocus.generation === generation && searchFocus.value,
    refreshing: refresh.controller === controller && refresh.generation === generation && refresh.active,
    salesManager: props.session.profile.role === 'sales_manager',
    roleLabel: `${a('users.role')}: ${state.selectedKind === null ? a('users.none_selected') : adminUserKindLabel(state.selectedKind, locale)}`,
    roleOptions: adminUserKinds.map(kind => ({ kind, label: adminUserKindLabel(kind, locale), selected: state.selectedKind === kind })),
    showFooter: adminUsersShowFooter(state.selectedKind, rows.length, state.loadingMore, state.hasMore),
    current: isCurrent, interactive, reload, openUser,
    setSearch: (text: string) => { if (interactive()) { setSearch({ controller, generation, text, edited: true }); controller.setSearch(text); } },
    setSearchFocused: (value: boolean) => { if ((value ? interactive() : lifetimeCurrent())) setSearchFocus({ controller, generation, value }); },
    toggleRoles: () => { if (interactive()) controller.toggleRoleMenu(); },
    selectRole: (kind: (typeof adminUserKinds)[number]) => { if (interactive()) controller.selectKind(kind); },
    scrollMetrics: (viewport: number, extentAfter: number) => { if (interactive()) controller.handleScrollMetrics(viewport, extentAfter); },
    loadMore: async () => { if (interactive()) await controller.loadMore(); },
    back,
  };
}
export type AdminUsersScreenModel = ReturnType<typeof useAdminUsersScreen>;
