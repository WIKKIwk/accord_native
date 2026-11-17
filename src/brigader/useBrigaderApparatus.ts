import { useCallback, useEffect, useMemo, useSyncExternalStore } from 'react';
import { usePreventRemove } from 'expo-router';
import { subscribeSessionWitness } from '../auth';
import { appRoutes } from '../shared/appRoutes';
import { localeController } from '../shared/localization/runtime';
import { useBrigaderFeature } from './BrigaderFeatureContext';
import { useBrigaderFlows } from './BrigaderFlowProvider';
import { useBrigaderNotice } from './useBrigaderNotice';
import { BrigaderApparatusController, type ApparatusModule } from './brigaderApparatusController';
import type { AdminApparatus } from '../apparatusApi';
export function useBrigaderApparatus(route: string, module: ApparatusModule, focusName: boolean) {
  const page = useBrigaderFeature(route), notice = useBrigaderNotice(), flows = useBrigaderFlows(), { current,interactive,shell,back:parentBack } = page;
  const owner = useMemo(() => new BrigaderApparatusController(shell.session,module,focusName,current,interactive,notice,() => localeController.locale),[shell.session,module,focusName,current,interactive,notice]);
  const state = useSyncExternalStore(owner.subscribe,owner.getSnapshot,owner.getSnapshot);
  useEffect(() => { const detach = owner.attach(() => { owner.maybeFocus(); void owner.load(); }), stop = subscribeSessionWitness(() => { if (!shell.isCurrent()) owner.dispose(); }); return () => { stop(); detach(); }; },[owner,shell]);
  usePreventRemove(state.module !== 'hub' && current(),() => owner.module('hub'));
  const back = useCallback(() => { if (state.module !== 'hub') owner.module('hub'); else parentBack(); },[owner,state.module,parentBack]);
  const openDetail = async (item: AdminApparatus) => { if (!interactive()) return; await flows.open({ route:appRoutes.adminApparatusSettings,args:{ detail:{ owner,id:item.id } } },{ isCurrent:current,canInteract:interactive }); if (current()) void owner.load(false); };
  return { page,owner,state,back,openDetail };
}
