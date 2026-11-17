import { useEffect,useMemo,useSyncExternalStore } from 'react';
import { subscribeSessionWitness } from '../auth';
import { appRoutes } from '../shared/appRoutes';
import { adminText } from '../shared/localization';
import { localeController } from '../shared/localization/runtime';
import { useBrigaderFeature } from './BrigaderFeatureContext';
import { useBrigaderNotice } from './useBrigaderNotice';
import { BrigaderWorkerSettingsModel } from './brigaderWorkerSettingsModel';
export function useBrigaderWorkerSettings(){
  const page=useBrigaderFeature(appRoutes.adminWorkerSettings),{shell,current,interactive}=page,notice=useBrigaderNotice();
  const owner=useMemo(()=>new BrigaderWorkerSettingsModel(shell.session,current,interactive,(key,values)=>adminText(key,localeController.locale,values),notice),[shell.session,current,interactive,notice]),state=useSyncExternalStore(owner.subscribe,owner.getSnapshot,owner.getSnapshot);
  useEffect(()=>{const detach=owner.attach(()=>{void owner.load();}),stop=subscribeSessionWitness(()=>{if(!shell.isCurrent())owner.dispose();});return()=>{stop();detach();};},[owner,shell]);
  return {page,owner,state};
}
