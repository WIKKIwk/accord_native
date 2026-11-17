import { useEffect,useMemo,useSyncExternalStore } from 'react';
import { subscribeSessionWitness } from '../auth';
import { appRoutes } from '../shared/appRoutes';
import { useBrigaderFeature } from './BrigaderFeatureContext';
import { BrigaderWipModel } from './brigaderWipModel';
export function useBrigaderWip() {
  const page = useBrigaderFeature(appRoutes.adminWipBatches),{ current,interactive,shell } = page;
  const owner = useMemo(() => new BrigaderWipModel(shell.session,current,interactive),[shell.session,current,interactive]),state = useSyncExternalStore(owner.subscribe,owner.getSnapshot,owner.getSnapshot);
  useEffect(() => { const detach = owner.attach(() => { void owner.load(); }),stop = subscribeSessionWitness(() => { if (!shell.isCurrent()) owner.dispose(); }); return () => { stop();detach(); }; },[owner,shell]);
  return { page,owner,state };
}
