import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { subscribeSessionWitness } from '../auth';
import type { AdminApparatus } from '../apparatusApi';
import { appRoutes } from '../shared/appRoutes';
import { localeController } from '../shared/localization/runtime';
import { BrigaderCapacityController } from './brigaderCapacityController';
import { useBrigaderFeature } from './BrigaderFeatureContext';
import { useBrigaderNotice } from './useBrigaderNotice';
export function useBrigaderCapacity(apparatus: readonly AdminApparatus[]) {
  const page = useBrigaderFeature(appRoutes.adminApparatusSettings), notice = useBrigaderNotice(), { current, interactive, shell } = page;
  const [initial] = useState(() => apparatus);
  const owner = useMemo(() => new BrigaderCapacityController(shell.session,initial,current,interactive,notice,() => localeController.locale),[shell.session,initial,current,interactive,notice]);
  useEffect(() => { owner.updateApparatus(apparatus); },[owner,apparatus]);
  const state = useSyncExternalStore(owner.subscribe,owner.getSnapshot,owner.getSnapshot);
  useEffect(() => { const detach = owner.attach(() => { void owner.load(); }), stop = subscribeSessionWitness(() => { if (!shell.isCurrent()) owner.dispose(); }); return () => { stop(); detach(); }; },[owner,shell]);
  return { page,owner,state };
}
