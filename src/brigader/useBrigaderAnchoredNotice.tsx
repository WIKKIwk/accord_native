import { useCallback,useEffect,useRef,useState,type ComponentRef } from 'react';
import { View,useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated,{Easing,useAnimatedStyle,useSharedValue,withTiming} from 'react-native-reanimated';
import { AdminTopNoticeContent } from '../admin/AdminTopNoticeContent';
import { adminTopNoticeService } from '../admin/adminTopNoticeRuntime';
import type { AdminAnchoredNoticeHandle } from '../admin/adminTopNoticeService';
import { adminTopNoticeColors,type AdminTopNoticeMessage } from '../admin/adminTopNoticeModel';
import { useBrigaderNotice } from './useBrigaderNotice';
/** Source overlay anchored to this real native sheet, with one global latest-notice handle. */
export function useBrigaderAnchoredNotice(current:()=>boolean){
 const anchor=useRef<ComponentRef<typeof View>>(null),measured=useRef(false),mounted=useRef(false),handle=useRef<AdminAnchoredNoticeHandle|null>(null),[value,setValue]=useState<AdminTopNoticeMessage|null>(null),[height,setHeight]=useState(0),[bottom,setBottom]=useState(0),progress=useSharedValue(0),size=useWindowDimensions(),insets=useSafeAreaInsets(),fallback=useBrigaderNotice();
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;measured.current=false;handle.current?.close();};},[]);
 const ready=useCallback(()=>mounted.current&&measured.current&&current(),[current]);
 const show=useCallback((message:string,tone:'success'|'error'='error')=>{if(!current())return;const next=adminTopNoticeService.showAnchored({message,tone},ready,notice=>{progress.set(0);setValue(notice);progress.set(withTiming(1,{duration:220,easing:Easing.out(Easing.cubic)}));},()=>{if(mounted.current)setValue(null);},()=>{if(ready())progress.set(withTiming(0,{duration:220,easing:Easing.out(Easing.cubic)}));});if(next)handle.current=next;else fallback(message,tone);},[current,ready,progress,fallback]);
 const layout=useCallback(()=>anchor.current?.measureInWindow((_,y,width,height)=>{if(!mounted.current||!current())return;measured.current=width>0&&height>0;setBottom(Math.max(0,Math.min(insets.bottom,insets.bottom-Math.max(0,size.height-y-height))));}),[current,insets.bottom,size.height]);
 const motion=useAnimatedStyle(()=>({opacity:progress.get(),transform:[{translateY:(1-progress.get())*height}]}));
 const overlay=value?<View pointerEvents="none" style={{position:'absolute',left:0,right:0,bottom:0,overflow:'hidden'}}><Animated.View onLayout={event=>setHeight(event.nativeEvent.layout.height)} style={[{backgroundColor:adminTopNoticeColors(value.tone).background,paddingBottom:bottom},motion]}><AdminTopNoticeContent banner={value}/></Animated.View></View>:null;
 return{anchor,layout,show,overlay};
}
