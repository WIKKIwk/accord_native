import { useCallback, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import { findNodeHandle, type ViewInstance } from 'react-native';
import type { AdminSourceDockScaffoldOwner } from './AdminSourceDockScaffoldOwner';
import { AdminSourceCreateHubPlacementOwner } from './AdminSourceCreateHubPlacementOwner';
import { localizedGetter } from '../shared/localization';
import { localeController } from '../shared/localization/runtime';
const subscribeLocale = (listener: () => void) => localeController.addListener(listener), getLocale = () => localeController.locale;

export function useAdminSourceCreateHubPlacement(source: AdminSourceDockScaffoldOwner) {
  const [owner] = useState(() => new AdminSourceCreateHubPlacementOwner(source)), view = useRef<ViewInstance>(null), matches = owner.matches(source);
  const state = useSyncExternalStore(owner.subscribe, owner.getSnapshot, owner.getSnapshot), locale = useSyncExternalStore(subscribeLocale, getLocale, getLocale);
  useLayoutEffect(() => { owner.commit(source); }); useLayoutEffect(() => owner.attach(), [owner]);
  const bind = useCallback(() => { const actual = view.current, tag = actual ? findNodeHandle(actual) : null; if (matches && actual && state.markerID && typeof tag === 'number') owner.bindMarker(actual, { tag, nativeID: state.markerID }, state.generation); }, [owner, matches, state.generation, state.markerID]);
  useLayoutEffect(bind, [bind]);
  return { owner, state, presentation: matches ? state.presentation : null, marker: { ref: view, nativeID: state.markerID ?? undefined, onLayout: bind },
    labels: { trigger: localizedGetter('adminCreateTitle', locale), closed: localizedGetter('createHubTitle', locale), close: localizedGetter('closeAction', locale) } };
}
