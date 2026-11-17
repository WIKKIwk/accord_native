import { useEffect,useMemo,useSyncExternalStore } from 'react';
import { subscribeSessionWitness } from '../auth';
import { adminText } from '../shared/localization';
import { localeController } from '../shared/localization/runtime';
import { useBrigaderFeature } from './BrigaderFeatureContext';
import { useBrigaderNotice } from './useBrigaderNotice';
import { BrigaderRawRulesModel } from './brigaderRawRulesModel';
export function useBrigaderRawRules(route:string){const page=useBrigaderFeature(route),{shell,current,interactive}=page,notice=useBrigaderNotice(),owner=useMemo(()=>new BrigaderRawRulesModel(shell.session,current,interactive,key=>adminText(key,localeController.locale),notice),[shell.session,current,interactive,notice]),state=useSyncExternalStore(owner.subscribe,owner.getSnapshot,owner.getSnapshot);useEffect(()=>{const detach=owner.attach(()=>{void owner.load();}),stop=subscribeSessionWitness(()=>{if(!shell.isCurrent())owner.dispose();});return()=>{stop();detach();};},[owner,shell]);return{page,owner,state};}
