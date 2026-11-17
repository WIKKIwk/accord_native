import { useMemo,useSyncExternalStore } from 'react';
import { ScrollView,Text,View,useWindowDimensions } from 'react-native';
import { adminText } from '../shared/localization';
import { AdminWarehouseRawQrPreview } from '../admin/AdminWarehouseRawQrPreview';
import { adminWarehouseRawQrPreview } from '../admin/adminWarehouseRawQrModel';
import { BrigaderPresentationHost } from './BrigaderPresentationHost';
import { BrigaderOpeningWipPicker } from './BrigaderOpeningWipPicker';
import { useBaseTheme } from '../components/useBaseTheme';
import { WorkerIconButton } from '../components/WorkerIconButton';
import { workerOrderText } from '../workerOrderText';
import { Form,Label,Action,ActionRow } from './BrigaderForm';
import { openingCard } from './openingWipPresentation';
import type { BrigaderOpeningWipModel,OpeningEntry } from './brigaderOpeningWipModel';
function Details({ owner,entry,locale,interactive,close }: { owner:BrigaderOpeningWipModel;entry:OpeningEntry;locale:string;interactive:()=>boolean;close:()=>void }) {
  const { colors } = useBaseTheme(),state = useSyncExternalStore(owner.subscribe,owner.getSnapshot,owner.getSnapshot),card = openingCard(entry,state.orders,state.apparatus,locale,true),size = useWindowDimensions(),a = (key:string) => adminText(key,locale),preview = useMemo(() => adminWarehouseRawQrPreview(entry.batch.qr_payload.trim()),[entry.batch.qr_payload]);
  return <View style={{ height:size.height*.84 }}><ScrollView contentContainerStyle={{ padding:16,paddingBottom:24 }}><View style={{ flexDirection:'row',alignItems:'center' }}><View style={{ flex:1 }}><Form><Label>{a('production.opening_wip.details_title')}</Label></Form></View><View pointerEvents={state.reprinting ? 'none' : 'auto'}><WorkerIconButton icon="close" label={workerOrderText('Yopish',locale)} onPress={close} /></View></View><AdminWarehouseRawQrPreview preview={preview} barcode={entry.batch.qr_payload.trim()} /><Form><Label>{card.title}</Label></Form><Text selectable style={{ textAlign:'center',fontWeight:'700',marginBottom:16,color:colors.onSurface }}>{entry.batch.qr_payload.trim()}</Text><Form>{card.lines.map((line,index) => <Label key={index}>{`${line.label}: ${line.value}`}</Label>)}<Action label={state.reprinting ? workerOrderText('Chop etilmoqda…',locale) : workerOrderText('Qayta chop etish',locale)} disabled={!!state.reprinting} onPress={() => { if (interactive()) void owner.reprint(entry); }} />{state.reprintMessage ? <Label>{state.reprintMessage}</Label> : null}</Form></ScrollView></View>;
}
export function BrigaderOpeningWipSurfaces({ owner,locale }: { owner:BrigaderOpeningWipModel;locale:string }) {
  const state = useSyncExternalStore(owner.subscribe,owner.getSnapshot,owner.getSnapshot),a = (key:string) => adminText(key,locale);
  return <BrigaderPresentationHost owner={owner.presentations} sheet={entry => entry.kind === 'order' || entry.kind === 'details'} dismissible={entry => entry.kind !== 'details' || !state.reprinting} render={(entry,interactive) => {
    if (entry.kind === 'order') return <BrigaderOpeningWipPicker entry={entry} owner={owner.presentations} interactive={interactive} locale={locale} />;
    if (entry.kind === 'details') return <Details owner={owner} entry={entry.data as OpeningEntry} locale={locale} interactive={interactive} close={() => { if (interactive() && !state.reprinting) owner.presentations.close(entry.id); }} />;
    if (entry.kind === 'duplicate') return <Form><Label>{a('production.opening_wip.duplicate_title')}</Label><Label>{a('production.opening_wip.duplicate_body')}</Label><ActionRow actions={[{ label:a('production.opening_wip.duplicate_no'),secondary:true,onPress:() => { if (interactive()) owner.presentations.close(entry.id,false); } },{ label:a('production.opening_wip.duplicate_yes'),onPress:() => { if (interactive()) owner.presentations.close(entry.id,true); } }]} /></Form>;
    if (entry.kind === 'delete') { const data = entry.data as { canDelete:boolean };return <Form><Label>{a('wip.delete.title')}</Label><Label>{a(data.canDelete ? 'wip.delete.message' : 'wip.delete.locked')}</Label><Action label={a('wip.delete.cancel')} secondary onPress={() => { if (interactive()) owner.presentations.close(entry.id,false); }} /><Action label={a('wip.delete.confirm')} onPress={() => { if (interactive()) owner.presentations.close(entry.id,true); }} /></Form>; }
    return null;
  }} />;
}
