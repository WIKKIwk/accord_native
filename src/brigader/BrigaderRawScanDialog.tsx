import { View } from 'react-native';
import { useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { rawMaterialBarcodeFromQr } from '../shared/barcode/rawMaterialBarcode';
import { productionText,adminText } from '../shared/localization';
import { workerOrderText } from '../workerOrderText';
import { Form,FieldsRow,Field,Action } from './BrigaderForm';
import { BrigaderSurfaceHeader } from './BrigaderSurfaceHeader';
import { BrigaderCameraViewport } from './BrigaderCameraViewport';
import { useBrigaderCamera } from './useBrigaderCamera';
export function BrigaderRawScanDialog({current,interactive,shown,locale,complete,close}:{current:()=>boolean;interactive:()=>boolean;shown:boolean;locale:string;complete:(barcode:string)=>void;close:()=>void}){const camera=useBrigaderCamera(current,shown,true),[manual,setManual]=useState(''),[done,setDone]=useState(false),submit=(raw:string)=>{if(done||!interactive())return;const barcode=rawMaterialBarcodeFromQr(raw);if(!barcode)return;setDone(true);complete(barcode);};return <SafeAreaView style={{flex:1}}><BrigaderSurfaceHeader title={productionText('worker.material.scanner.title',locale)} closeLabel={adminText('action.close',locale)} onClose={close}/><BrigaderCameraViewport camera={camera} locale={locale} full detected={submit}/><Form><FieldsRow action={<View style={{width:92}}><Form><Action label={workerOrderText('OK',locale)} onPress={()=>submit(manual)}/></Form></View>}>{[<Field key="manual" label={productionText('worker.material.scanner.manual',locale)} value={manual} onChange={value=>{if(interactive())setManual(value);}}/>]}</FieldsRow></Form></SafeAreaView>;}
