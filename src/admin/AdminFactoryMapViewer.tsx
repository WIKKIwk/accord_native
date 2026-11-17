import { Asset } from 'expo-asset';
import { File } from 'expo-file-system';
import { useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo } from 'react-native';
import { WebView } from 'react-native-webview';
import { adminText } from '../shared/localization';
import modelAsset from '../../assets/factory-map/zavod6-runtime.glb';
import { factoryMapRenderer } from './factoryMapRendererBundle';
export type FactoryMapObjectSelection = { objectId:string;label:string };
export type FactoryMapViewerProps = { locale:string;selectedObjectId?:string;selectionMode?:boolean;interactionEnabled?:boolean;renderSuspended?:boolean;focusedObjectId?:string;resetRevision?:number;liveState?:unknown;stockState?:unknown;showLabels?:boolean;onObjectTap?:(selection:FactoryMapObjectSelection)=>void;onFocusComplete?:(id:string)=>void;onLoadError?:()=>void };
let model: Promise<string> | null = null;
function modelBytes() { return model ??= Asset.fromModule(modelAsset).downloadAsync().then(asset => new File(asset.localUri ?? asset.uri).base64()).catch(error => { model = null; throw error; }); }
const escape = (value:string) => value.replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;').replaceAll('>','&gt;');
/** V2's exact offline Three.js renderer, geometry, picking, camera and live/stock projections. */
export function AdminFactoryMapViewer(props:FactoryMapViewerProps) {
  const web = useRef<WebView<object>>(null), [bytes,setBytes] = useState<string|null>(null), [reduceMotion,setReduceMotion] = useState<boolean|null>(null);
  const { onLoadError } = props;
  const a = (key:string) => adminText(key,props.locale);
  useEffect(() => { let mounted = true; void modelBytes().then(value => { if (mounted) setBytes(value); }).catch(() => { if (mounted) onLoadError?.(); }); return () => { mounted = false; }; },[onLoadError]);
  useEffect(() => { let mounted = true,revision = 0; const stop = AccessibilityInfo.addEventListener('reduceMotionChanged',value => { revision++; if (mounted) setReduceMotion(value); }); const version = revision; void AccessibilityInfo.isReduceMotionEnabled().then(value => { if (mounted && revision === version) setReduceMotion(value); }); return () => { mounted = false; stop.remove(); }; },[]);
  const state = JSON.stringify({ enabled:props.interactionEnabled !== false,renderSuspended:props.renderSuspended === true,focusedObjectId:props.focusedObjectId ?? '',resetRevision:props.resetRevision ?? 0,reducedMotion:reduceMotion,live:props.selectionMode ? {} : props.liveState ?? {},stock:props.selectionMode ? {} : props.stockState ?? {},showLabels:!props.selectionMode && props.showLabels !== false });
  const [initial] = useState(() => ({ selected:props.selectedObjectId?.trim() ?? '',selection:props.selectionMode === true,locale:props.locale }));
  const ready = reduceMotion !== null;
  const source = useMemo(() => {
    if (!bytes || !ready) return { html:`<!doctype html><html><body style="background:#daddd7;display:grid;place-items:center;height:100vh;margin:0"><div>${escape(adminText('factory_map.model_loading',initial.locale))}</div></body></html>` };
    return { html:`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no"><style>html,body{margin:0;width:100%;height:100%;overflow:hidden;background:#daddd7}#factory-map-canvas{position:absolute;inset:0;width:100%;height:100%;display:block;touch-action:none;background:#daddd7}#factory-map-status{position:fixed;inset:0;display:grid;place-items:center;color:#314351;font:14px sans-serif}</style></head><body data-model-viewer-state="{}"><canvas id="factory-map-canvas" data-factory-map-canvas draggable="false" data-model-src="data:application/octet-stream;base64,${bytes}" data-selection-mode="${initial.selection}" data-selected-object-id="${escape(initial.selected)}"></canvas><div id="factory-map-status" data-factory-map-status>${escape(adminText('factory_map.model_loading',initial.locale))}</div><div data-factory-map-bridge hidden></div><script>window.FactoryMapChannel={postMessage:message=>window.ReactNativeWebView.postMessage(message)};${factoryMapRenderer.replaceAll('</script','<\\/script')}try{FactoryMapRenderer.mountFactoryMap()}catch(error){document.querySelector('[data-factory-map-status]').textContent=${JSON.stringify(adminText('factory_map.renderer_failed',initial.locale))};window.FactoryMapChannel.postMessage(JSON.stringify({type:'load_error'}))}window.addEventListener('pagehide',()=>document.body.dispatchEvent(new Event('model-viewer-dispose')));</script></body></html>` };
  },[bytes,initial,ready]);
  const update = () => web.current?.injectJavaScript(`document.body.setAttribute('data-model-viewer-state',${JSON.stringify(state)});document.body.dispatchEvent(new Event('model-viewer-state'));true;`);
  useEffect(() => { update(); });
  return <WebView<object> ref={web} source={source} style={{ flex:1,backgroundColor:'#daddd7' }} originWhitelist={['about:*','data:*']} javaScriptEnabled domStorageEnabled scrollEnabled={false} bounces={false} overScrollMode="never" onLoadEnd={update} onError={props.onLoadError} onShouldStartLoadWithRequest={request => request.url === 'about:blank' || request.url.startsWith('data:')} onMessage={event => {
    let payload:unknown; try { payload = JSON.parse(event.nativeEvent.data); } catch { return; }
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return; const value = payload as Record<string,unknown>;
    if (value.type === 'load_error') { props.onLoadError?.(); return; } const objectId = String(value.objectId ?? '').trim(); if (!objectId) return;
    if (value.type === 'focus_complete') props.onFocusComplete?.(objectId);
    else if (value.type === 'object_tap') props.onObjectTap?.({ objectId,label:String(value.label ?? '').trim() || `${a('factory_map.object_fallback')} · ${objectId}` });
  }} />;
}
