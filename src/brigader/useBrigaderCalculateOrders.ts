import { useEffect,useMemo,useSyncExternalStore } from 'react';
import { subscribeSessionWitness } from '../auth';
import { appRoutes } from '../shared/appRoutes';
import { useBrigaderFeature } from './BrigaderFeatureContext';
import { useBrigaderCalculateStore } from './BrigaderCalculateStore';
import { useBrigaderNotice } from './useBrigaderNotice';
import { BrigaderCalculateOrdersModel } from './brigaderCalculateOrdersModel';
export function useBrigaderCalculateOrders(){const page=useBrigaderFeature(appRoutes.adminCalculateOrders),{current,interactive,shell}=page,store=useBrigaderCalculateStore(),notice=useBrigaderNotice(),owner=useMemo(()=>new BrigaderCalculateOrdersModel(store,current,interactive,notice),[store,current,interactive,notice]),state=useSyncExternalStore(owner.subscribe,owner.getSnapshot,owner.getSnapshot);useSyncExternalStore(store.subscribe,store.getSnapshot,store.getSnapshot);useEffect(()=>{const detach=owner.attach(()=>{void owner.load();}),stop=subscribeSessionWitness(()=>{if(!shell.isCurrent())owner.dispose();});return()=>{stop();detach();};},[owner,shell]);return{page,owner,state};}
