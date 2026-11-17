import { useEffect, useMemo, useSyncExternalStore } from 'react';
import { AppState } from 'react-native';
import { subscribeSessionWitness } from '../auth';
import { appRoutes } from '../shared/appRoutes';
import { localeController } from '../shared/localization/runtime';
import { useBrigaderFeature } from './BrigaderFeatureContext';
import { useBrigaderNotice } from './useBrigaderNotice';
import { BrigaderNotifications } from './brigaderNotificationController';
export function useBrigaderNotifications() {
  const page = useBrigaderFeature(appRoutes.adminNotifications), notice = useBrigaderNotice(), { current, interactive, shell } = page;
  const owner = useMemo(() => new BrigaderNotifications(shell.session, current, interactive, notice, () => localeController.locale), [shell.session, current, interactive, notice]);
  const state = useSyncExternalStore(owner.subscribe, owner.getSnapshot, owner.getSnapshot);
  useEffect(() => { const detach = owner.attach(), app = AppState.addEventListener('change', state => owner.setForeground(state === 'active')), stop = subscribeSessionWitness(() => { if (!shell.isCurrent()) owner.dispose(); }); return () => { app.remove(); stop(); detach(); }; }, [owner, shell]);
  return { page, owner, state };
}
