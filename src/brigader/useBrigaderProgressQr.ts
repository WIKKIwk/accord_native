import { useEffect,useMemo,useSyncExternalStore } from 'react';
import { File,Paths } from 'expo-file-system';
import { shareAsync } from 'expo-sharing';
import { subscribeSessionWitness } from '../auth';
import { appRoutes } from '../shared/appRoutes';
import { useBrigaderFeature } from './BrigaderFeatureContext';
import { useBrigaderCamera } from './useBrigaderCamera';
import { useBrigaderSnackMessage } from './useBrigaderSnackMessage';
import { BrigaderProgressQrModel,BrigaderProgressQrArgs } from './brigaderProgressQrModel';
import type { AdminProgressQrLookupScanner } from '../admin/adminProgressQrLookupController';
export function useBrigaderProgressQr(){const page=useBrigaderFeature(appRoutes.adminProgressQrScan),{current,interactive,shell,back}=page,camera=useBrigaderCamera(current,interactive(),false),message=useBrigaderSnackMessage(current,false),scanOnly=page.args instanceof BrigaderProgressQrArgs&&page.args.scanOnly;
 const {owner:cameraOwner,start:startCamera}=camera;
 const scanner=useMemo<AdminProgressQrLookupScanner>(()=>({stop:async guard=>{guard();await cameraOwner.stop();guard();},retry:async guard=>{guard();try{await startCamera();guard();return cameraOwner.getSnapshot().ready;}catch(error){guard();cameraOwner.failed(error);return false;}},phase:()=>{const state=cameraOwner.getSnapshot();return state.error?'error':state.ready?'running':state.wanted?'starting':'idle';}}),[cameraOwner,startCamera]);
 const owner=useMemo(()=>new BrigaderProgressQrModel(shell.session,shell.witness,current,interactive,scanOnly,scanner,back,startCamera,async(bytes,filename,guard)=>{guard();const output=new File(Paths.cache,filename);if(output.exists)output.delete();output.create();await output.write(bytes);guard();await shareAsync(output.uri,{mimeType:'application/pdf',UTI:'com.adobe.pdf',dialogTitle:filename});},message),[shell.session,shell.witness,current,interactive,scanOnly,scanner,back,startCamera,message]),state=useSyncExternalStore(owner.lookup.controller.subscribe,owner.lookup.controller.getSnapshot,owner.lookup.controller.getSnapshot),sharing=useSyncExternalStore(owner.subscribe,owner.getSnapshot,owner.getSnapshot);
 useEffect(()=>{const detach=owner.attach(()=>{owner.lookup.controller.start();void startCamera().catch(error=>cameraOwner.failed(error));}),stop=subscribeSessionWitness(()=>{if(!shell.isCurrent())owner.dispose();});return()=>{stop();detach();};},[owner,shell,cameraOwner,startCamera]);
 return{page,owner,state,camera,sharing:sharing.sharing};
}
