import { useCallback,useEffect,useLayoutEffect,useMemo,useRef,useState,useSyncExternalStore } from 'react';
import { AppState } from 'react-native';
import { useCameraSurfacePermission } from '../shared/camera/useCameraSurfacePermission';
import { BrigaderCameraSession } from './brigaderCameraSession';
export function useBrigaderCamera(current:()=>boolean,enabled:boolean,autoStart=false){
 const permission=useCameraSurfacePermission(),{requestPermission,refreshPermission,canUseCamera}=permission;
 const owner=useMemo(()=>new BrigaderCameraSession(current),[current]);
 const state=useSyncExternalStore(owner.subscribe,owner.getSnapshot,owner.getSnapshot);
 const [foreground,setForeground]=useState(AppState.currentState==='active'),prompted=useRef(false);
 useEffect(()=>owner.mount(),[owner]);
 useLayoutEffect(()=>{owner.permissionChanged(permission.permission,permission.error);},[owner,permission.permission,permission.error]);
 useEffect(()=>{
  if(autoStart&&enabled&&foreground&&permission.permission&&!permission.permission.granted&&!prompted.current&&permission.permission.canAskAgain){prompted.current=true;void requestPermission().catch(()=>{});}
 },[autoStart,enabled,foreground,permission.permission,requestPermission]);
 useEffect(()=>{
  const listener=AppState.addEventListener('change',value=>{setForeground(value==='active');if(value!=='active')void owner.stop().catch(()=>{});else void refreshPermission().catch(()=>{});});
  return()=>listener.remove();
 },[owner,refreshPermission]);
 useEffect(()=>{
  if(autoStart&&enabled&&foreground&&permission.permission?.granted)void owner.start().catch(()=>{});
  else if(!enabled)void owner.stop().catch(()=>{});
 },[owner,autoStart,enabled,foreground,permission.permission?.granted]);
 const active=enabled&&foreground&&state.wanted&&permission.permission?.granted===true&&!permission.checking&&!permission.error;
 useLayoutEffect(()=>{owner.committedActive(active);},[owner,active]);
 const start=useCallback(async()=>{
  if(!owner.current())throw new Error('Camera owner expired');
  if(!canUseCamera()){const result=await requestPermission();if(!owner.current())throw new Error('Camera owner expired');owner.permissionChanged(result,null);if(!result.granted)throw new Error('Camera permission denied');}
  await owner.start();
 },[owner,canUseCamera,requestPermission]);
 return{owner,state,permission,active,start};
}
