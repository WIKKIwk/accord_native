import { useEffect,useMemo,useSyncExternalStore } from 'react';
import { AppState } from 'react-native';
import { useNavigation,type NativeStackNavigationProp } from 'expo-router';
import { subscribeSessionWitness } from '../auth';
import { appRoutes } from '../shared/appRoutes';
import { useBrigaderFeature } from './BrigaderFeatureContext';
import { useBrigaderNotice } from './useBrigaderNotice';
import { BrigaderFactoryMapModel } from './brigaderFactoryMapModel';
export function useBrigaderFactoryMap(){const page=useBrigaderFeature(appRoutes.adminFactoryMap),{shell,current,interactive}=page,notice=useBrigaderNotice(),navigation=useNavigation<NativeStackNavigationProp<Record<string,object|undefined>>>(),owner=useMemo(()=>new BrigaderFactoryMapModel(shell.session,current,interactive,notice),[shell.session,current,interactive,notice]),state=useSyncExternalStore(owner.subscribe,owner.getSnapshot,owner.getSnapshot);
 useEffect(()=>{const detach=owner.attach(()=>{}),transition=navigation.addListener('transitionEnd',event=>{if(!event.data.closing&&owner.current())owner.start();}),app=AppState.addEventListener('change',value=>owner.foreground(value==='active')),stop=subscribeSessionWitness(()=>{if(!shell.isCurrent())owner.dispose();});let frame:number|undefined;if((navigation.getState()?.index??0)===0)frame=requestAnimationFrame(owner.start);return()=>{if(frame!==undefined)cancelAnimationFrame(frame);transition();app.remove();stop();detach();};},[owner,navigation,shell]);
 return{page,owner,state};}
