import type { Session } from '../auth';
import { adminWipBatches } from '../workerWipApi';
import { adminApparatus, type AdminApparatus } from '../apparatusApi';
import { adminProgressBatchIsFinishedGoodsOutput } from '../workerProgressModel';
import { adminProgressQrQuantityParts } from '../admin/adminProgressQrTechnicalMaterialPresentation';
import { adminText } from '../shared/localization';
import { dartFutureWait } from '../shared/dartFutureWait';
import { BrigaderModel } from './brigaderModel';
export type WipBatch = Awaited<ReturnType<typeof adminWipBatches>>[number];
type State = { loading:boolean;hasData:boolean;error:unknown;filter:string;expanded:boolean;rows:WipBatch[];locations:string[];apparatus:AdminApparatus[];refreshing:boolean };
export const canonicalWaitingLocation = (batch:WipBatch) => String(batch.current_location ?? '').trim() || String(batch.current_apparatus ?? '').trim() || String(batch.apparatus ?? '').trim();
export const filterWipBatchesForWaitingDisplay = (rows:WipBatch[],location:string) => rows.filter(row => String(row.wip_status).trim() === 'waiting' && (!location.trim() || canonicalWaitingLocation(row) === location.trim()));
export function isFinalFreeWip(batch:WipBatch) { const flow = String(batch.status_detail.flow_status).trim(); return ['free_wip','finished_pending_acceptance'].includes(flow) || adminProgressBatchIsFinishedGoodsOutput({ action:batch.action,status:batch.status,next_apparatus:batch.next_apparatus }) && String(batch.wip_status).trim() === 'waiting' && !String(batch.next_apparatus).trim(); }
export class BrigaderWipModel extends BrigaderModel<State> {
  private generation = 0;
  constructor(private readonly session:Session,current:()=>boolean,interactive:()=>boolean) { super({ loading:true,hasData:false,error:null,filter:'',expanded:false,rows:[],locations:[],apparatus:[],refreshing:false },current,interactive); }
  load = async (filter = this.state.filter) => { if (!this.current()) return; const generation = ++this.generation,location = filter.trim(); this.patch({ loading:true,refreshing:true,error:null });
    try { const [all,apparatus] = await dartFutureWait([adminWipBatches(this.session,{ status:'waiting',limit:250,current:this.current }),adminApparatus(this.session,{ limit:10000,beforeSend:this.guard })] as const); this.guard();
      const verified = filterWipBatchesForWaitingDisplay(all,''), locations = [...new Set(verified.map(canonicalWaitingLocation).filter(Boolean))].sort((a,b) => a.toLowerCase() < b.toLowerCase() ? -1 : a.toLowerCase() > b.toLowerCase() ? 1 : 0);
      const loaded = location ? await adminWipBatches(this.session,{ status:'waiting',currentLocation:location,limit:250,current:this.current }) : verified;
      if (generation === this.generation) this.patch({ loading:false,hasData:true,error:null,rows:filterWipBatchesForWaitingDisplay(loaded,location),locations,apparatus,refreshing:false });
    } catch (error) { if (generation === this.generation) this.patch({ loading:false,error,refreshing:false }); }
  };
  toggle = () => { if (this.interactive()) this.patch({ expanded:!this.state.expanded }); };
  filter = (value:string) => { if (!this.interactive()) return; const filter = value.trim(),changed = filter !== this.state.filter; this.patch({ filter,expanded:false }); if (changed) void this.load(filter); };
  override dispose() { super.dispose(); this.generation++; }
}
export type BrigaderInfoCardModel = { title:string;subtitle?:string;badge?:string;lines:{ label:string;value:string }[];summary?:string;footer?:string };
export function wipBatchCard(batch:WipBatch,catalog:AdminApparatus[],locale:string):BrigaderInfoCardModel {
  const a = (key:string,values?:Record<string,unknown>) => adminText(key,locale,values), first = (values:unknown[]) => values.map(value => String(value ?? '').trim()).find(Boolean) || '-', label = (id:string) => { const value = id.trim(); return catalog.find(item => item.id.trim() === value)?.name.trim() || value; };
  const headline = (value:string) => { const text = value.trim().split(',')[0].trim(); return !text ? a('wip.product_fallback') : text.toLowerCase().includes('mahsulot') ? text : a('wip.product_suffix',{ title:text }); };
  const title = headline(first([batch.label_item_name,batch.label_item_code,batch.order_id])), place = label(first([canonicalWaitingLocation(batch),batch.current_location,batch.current_apparatus,batch.apparatus])), source = label(batch.apparatus) || '-', worker = first([batch.worker_display_name,batch.executor_name,batch.worker_ref]), quantity = adminProgressQrQuantityParts(batch.produced_qty,batch.uom), free = isFinalFreeWip(batch), next = batch.next_apparatus.trim() ? label(batch.next_apparatus) : a('wip.unspecified');
  const language = locale.toLowerCase().split(/[-_]/)[0], english = language === 'en',urdu = language === 'ur', product = headline(batch.label_item_name);
  const sourceText = source === '-' ? english ? 'an unknown machine' : urdu ? 'نامعلوم مشین' : 'noma’lum aparatdan' : english || urdu ? source : `${source}dan`;
  const waitingPlace = place === '-' ? english ? 'an unknown location' : urdu ? 'نامعلوم مقام' : 'noma’lum joyda' : english ? `at ${place}` : urdu ? place : `${place} yonida`;
  const workerText = worker === '-' ? '' : english ? ` Worker: ${worker}.` : urdu ? ` کارکن: ${worker}۔` : ` Ishchi: ${worker}.`;
  return { title,subtitle:a('wip.order',{ order:batch.order_id }),badge:a('wip.status.waiting'),lines:[{ label:a('wip.quantity'),value:quantity },{ label:a('wip.source'),value:source },{ label:a('wip.current_location'),value:place.trim() || '-' },...(free ? [{ label:a('wip.product_status'),value:a('wip.free') }] : [{ label:a('wip.next_apparatus'),value:next },{ label:a('wip.next_step'),value:next }]),{ label:a('wip.worker'),value:worker }],summary:a(free ? 'wip.summary.free' : 'wip.summary.waiting',{ product,source:sourceText,place:waitingPlace,step:next,apparatus:next,quantity,worker:workerText }),footer:batch.qr_payload.trim() || undefined };
}
