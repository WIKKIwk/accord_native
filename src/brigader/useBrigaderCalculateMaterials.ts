import { useEffect,useMemo,useSyncExternalStore } from 'react';
import { subscribeSessionWitness } from '../auth';
import { appRoutes } from '../shared/appRoutes';
import { adminText } from '../shared/localization';
import { localeController } from '../shared/localization/runtime';
import { useBrigaderFeature } from './BrigaderFeatureContext';
import { useBrigaderSnackMessage } from './useBrigaderSnackMessage';
import { BrigaderCalculateMaterialsModel } from './brigaderCalculateMaterialsModel';
export function useBrigaderCalculateMaterials(){const page=useBrigaderFeature(appRoutes.adminCalculateMaterials),{current,interactive,shell}=page,message=useBrigaderSnackMessage(current,false),owner=useMemo(()=>new BrigaderCalculateMaterialsModel(shell.session,current,interactive,key=>adminText(key,localeController.locale),message),[shell.session,current,interactive,message]),state=useSyncExternalStore(owner.subscribe,owner.getSnapshot,owner.getSnapshot);useEffect(()=>{const detach=owner.attach(()=>{void owner.load();}),stop=subscribeSessionWitness(()=>{if(!shell.isCurrent())owner.dispose();});return()=>{stop();detach();};},[owner,shell]);return{page,owner,state};}
