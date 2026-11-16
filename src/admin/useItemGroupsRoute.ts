import { ItemGroupsInteraction } from './itemGroupsInteraction';
import { useIsFocused } from 'expo-router';
import { createItemGroupsSession } from './itemGroupsSession';
import { useEffect, useLayoutEffect, useMemo, useSyncExternalStore, type ReactNode } from 'react';
import { subscribeSessionWitness, type Session, type SessionWitness } from '../auth';
import { adminText } from '../shared/localization';
import { localeController } from '../shared/localization/runtime';
import { itemGroupsMerge, itemGroupsTree } from './itemGroupsModel';
export type ItemGroupsRouteProps = { session: Session; witness: SessionWitness; isCurrent: () => boolean;
  navigation: { icon: 'menu' | 'back'; label: string; onPress: () => void; testID?: string } | null; footer?: ReactNode };
const subscribeLocale = (listener: () => void) => localeController.addListener(listener), currentLocale = () => localeController.locale;
export function useItemGroupsRoute({ session, witness, isCurrent }: ItemGroupsRouteProps) {
  const focused = useIsFocused(), interaction = useMemo(() => new ItemGroupsInteraction(), []);
  useLayoutEffect(() => { interaction.setFocused(focused); return () => interaction.setFocused(false); }, [focused, interaction]);
  const owner = useMemo(() => createItemGroupsSession(session, witness, isCurrent, interaction.canInteract), [session, witness, isCurrent, interaction]);
  useEffect(() => { if (!focused) owner.controller.suspendInteraction(); }, [owner, focused]);
  const state = useSyncExternalStore(owner.controller.subscribe, owner.controller.getSnapshot, owner.controller.getSnapshot);
  const locale = useSyncExternalStore(subscribeLocale, currentLocale, currentLocale);
  useEffect(() => {
    const check = () => { if (!owner.current()) owner.controller.invalidate(); };
    const unsubscribe = subscribeSessionWitness(check); owner.controller.start(); check();
    return () => { unsubscribe(); owner.controller.dispose(); };
  }, [owner]);
  useEffect(() => { if (!state.notice) return; const id = state.notice.id, timer = setTimeout(() => owner.controller.dismissNotice(id), state.notice.success ? 5000 : 4000); return () => clearTimeout(timer); }, [owner, state.notice]);
  const t = useMemo(() => (key: string, values: Record<string, unknown> = {}) => adminText(key, locale, values), [locale]);
  return { state, focused, controller: owner.controller, current: owner.current, locale, t,
    roots: itemGroupsTree(state.tree), displayGroups: itemGroupsMerge(state.selectedGroup ? [state.selectedGroup, ...state.parents] : state.parents),
    pickerRows: owner.controller.pickerRows() };
}
export type ItemGroupsRouteModel = ReturnType<typeof useItemGroupsRoute>;
