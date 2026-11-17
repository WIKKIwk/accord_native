import { useEffect, useMemo, useSyncExternalStore } from 'react';
import { subscribeSessionWitness } from '../auth';
import { appRoutes } from '../shared/appRoutes';
import { productionText } from '../shared/localization';
import { localeController } from '../shared/localization/runtime';
import { useBrigaderFeature } from './BrigaderFeatureContext';
import { useBrigaderFlows } from './BrigaderFlowProvider';
import { useBrigaderSnackMessage } from './useBrigaderSnackMessage';
import { BrigaderPaddonListModel } from './brigaderPaddonListModel';
export function useBrigaderPaddons() {
  const page = useBrigaderFeature(appRoutes.apparatusPaddons), flows = useBrigaderFlows(), { current,interactive,shell } = page;
  const args = page.args as { apparatusId?:string;apparatusName?:string } | undefined, apparatus = args?.apparatusId?.trim() ?? '',name = args?.apparatusName?.trim() ?? '', message = useBrigaderSnackMessage(current);
  const owner = useMemo(() => new BrigaderPaddonListModel(shell.session,apparatus,name,current,interactive,
    async row => { await flows.open({ route:appRoutes.apparatusPaddonDetail,args:{ code:row.code,apparatusId:apparatus,apparatusName:name } },{ isCurrent:current,canInteract:interactive }); },
    async () => { await flows.open({ route:appRoutes.apparatusPaddons,args:{ transfer:true,apparatusId:apparatus } },{ isCurrent:current,canInteract:interactive }); },message,(key,values) => productionText(key,localeController.locale,values)),[shell.session,apparatus,name,current,interactive,flows,message]);
  const state = useSyncExternalStore(owner.subscribe,owner.getSnapshot,owner.getSnapshot);
  useEffect(() => { const detach = owner.attach(() => { void owner.load(); }), stop = subscribeSessionWitness(() => { if (!shell.isCurrent()) owner.dispose(); }); return () => { stop(); detach(); }; },[owner,shell]);
  return { page,owner,state,p:(key:string,values?:Record<string,unknown>) => productionText(key,page.locale,values) };
}
