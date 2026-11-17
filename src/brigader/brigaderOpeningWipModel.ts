import { nativeEpochMicroseconds } from '../../modules/accord-native-clock/src/AccordNativeClockModule';
import type { Session } from '../auth';
import { adminApparatus,type AdminApparatus } from '../apparatusApi';
import { adminProductionMaps } from '../productionMapReadApi';
import { adminProductionMapQueueSnapshot } from '../productionMapQueueSnapshotApi';
import { adminOpeningWipRecords,openingWipIntakeSourceStageNodeId } from '../workerOpeningWipRecordsApi';
import { adminCreateOpeningWip } from '../admin/openingWipApi';
import { adminDeleteOpeningWipBatch } from '../admin/openingWipDeleteApi';
import { materialMapWorkStages,materialMapNextStages } from '../material/materialTaskMapModel';
import { isCanonicalApparatusId,WorkerControlException } from '../workerControlsApi';
import { dartFutureWait } from '../shared/dartFutureWait';
import { MobileApiException } from '../shared/mobileApiException';
import type { AdminOpeningWipQuantityBasis } from '../admin/openingWipInput';
import { BrigaderModel } from './brigaderModel';
import { BrigaderPresentations } from './brigaderPresentations';
export type OpeningRecord = Awaited<ReturnType<typeof adminOpeningWipRecords>>[number];
export type OpeningBatch = OpeningRecord['batches'][number];
export type OpeningEntry = { record:OpeningRecord;batch:OpeningBatch };
export type OpeningOrder = Awaited<ReturnType<typeof adminProductionMaps>>[number];
export type OpeningRoll = { meter:string;kg:string;bobina:string;diameter:string };
type State = { loading:boolean;hasData:boolean;error:unknown;orders:OpeningOrder[];apparatus:AdminApparatus[];snapshot:Record<string,any>|null;tab:number;selectedOrder:string;sourceNode:string;rollCount:string;rolls:OpeningRoll[];basis:AdminOpeningWipQuantityBasis;submitting:boolean;validation:Record<string,string>;submitError:string;created:OpeningRecord|null;printed:ReadonlySet<string>;records:OpeningRecord[];listLoading:boolean;listHasData:boolean;listError:unknown;filter:string;expanded:boolean;deleting:string;reprinting:string;reprintMessage:string };
const roll = ():OpeningRoll => ({ meter:'',kg:'',bobina:'',diameter:'' });
const parse = (value:string) => value.trim() && Number.isFinite(Number(value.trim().replaceAll(',','.'))) ? Number(value.trim().replaceAll(',','.')) : null;
const sourceError = (error:unknown) => error instanceof MobileApiException || error instanceof WorkerControlException ? error.message : null;
export const openingWipBatchCanDelete = (batch:OpeningBatch) => batch.wip_status.trim().toLowerCase() === 'waiting' && !batch.used_by_session_id.trim() && !batch.used_by_apparatus.trim() && !batch.processed_by_session_id.trim() && !batch.processed_by_apparatus.trim();
export const openingWipSourceApparatus = (record:OpeningRecord) => [record.intake.source_apparatus.trim(),record.intake.entry_apparatus.trim()].find(isCanonicalApparatusId) ?? '';
export const activeOpeningRecords = (records:OpeningRecord[]) => records.filter(record => record.intake.status.trim().toLowerCase() !== 'cancelled' && record.batches.some(batch => batch.wip_status.trim().toLowerCase() !== 'void'));
/** @v2 productionMapOpeningWipSourceStages */
export function openingSourceStages(order:OpeningOrder|undefined,states:Record<string,Record<string,string>>) {
  if (!order) return []; const stages = materialMapWorkStages(order.map).filter(stage => stage.apparatusId?.trim());
  if (stages.length && stages.every(stage => states[order.map.id.trim()]?.[stage.nodeId.trim()]?.trim().toLowerCase() === 'completed')) return [];
  return stages.filter(stage => materialMapNextStages(order.map,stage.nodeId).length && isCanonicalApparatusId(stage.apparatusId!)).map(stage => { const node = order.map.nodes.find(node => node.id === stage.nodeId)!; return { ...stage,title:node.kind === 'apparatus' && !node.alternative_group_id.trim() && node.alternative_assigned_title.trim() ? node.alternative_assigned_title.trim() : node.title.trim() }; });
}
export class BrigaderOpeningWipModel extends BrigaderModel<State> {
  readonly presentations = new BrigaderPresentations(this.current); private generation = 0; private listGeneration = 0;private listStarted = false; private key = '';private fingerprint = '';
  constructor(private readonly session:Session,current:()=>boolean,interactive:()=>boolean,private readonly a:(key:string,values?:Record<string,unknown>)=>string,private readonly notice:(message:string)=>void,private readonly print:{ pick:()=>Promise<unknown|null>;batch:(batch:OpeningBatch,printer:unknown)=>Promise<void> }) {
    super({ loading:true,hasData:false,error:null,orders:[],apparatus:[],snapshot:null,tab:0,selectedOrder:'',sourceNode:'',rollCount:'1',rolls:[roll()],basis:'measured',submitting:false,validation:{},submitError:'',created:null,printed:new Set(),records:[],listLoading:true,listHasData:false,listError:null,filter:'',expanded:false,deleting:'',reprinting:'',reprintMessage:'' },current,interactive);
  }
  order = () => this.state.orders.find(order => order.map.id === this.state.selectedOrder);
  stages = () => openingSourceStages(this.order(),this.state.snapshot?.stage_states ?? {});
  source = () => this.stages().find(stage => stage.nodeId.trim() === this.state.sourceNode.trim());
  requiresDiameter = () => this.state.apparatus.find(item => item.id === this.source()?.apparatusId)?.operation.trim().toLowerCase() === 'cut';
  needsRetry = () => !!this.state.created && this.state.printed.size < this.state.created.batches.length;
  load = async () => { if (!this.current()) return; const generation = ++this.generation;this.patch({ loading:true,error:null });
    try { const [all,apparatus,snapshot] = await dartFutureWait([adminProductionMaps(this.session),adminApparatus(this.session,{ limit:10000,beforeSend:this.guard }),adminProductionMapQueueSnapshot(this.session,{ current:this.current })] as const);this.guard(); if (generation !== this.generation) return;
      const orders = all.filter(order => ['zakaz-','training-zakaz-'].some(prefix => order.map.id.trim().startsWith(prefix)) && openingSourceStages(order,snapshot.stage_states).length);
      this.patch({ loading:false,hasData:true,error:null,orders,apparatus,snapshot,selectedOrder:orders[0]?.map.id ?? '',sourceNode:openingSourceStages(orders[0],snapshot.stage_states)[0]?.nodeId ?? '' });
    } catch (error) { if (generation === this.generation) this.patch({ loading:false,error }); }
  };
  loadList = async () => { if (!this.current()) return; this.listStarted = true;const generation = ++this.listGeneration;this.patch({ listLoading:true,listError:null });
    try { const records = await adminOpeningWipRecords(this.session,{ status:'all',limit:500 },this.current,{ beforeSend:this.guard }); if (generation === this.listGeneration) this.patch({ records,listLoading:false,listHasData:true,listError:null }); }
    catch (error) { if (generation === this.listGeneration) this.patch({ listLoading:false,listError:error }); }
  };
  selectTab = (tab:number) => { if (!this.interactive()) return;this.patch({ tab });if (tab === 1 && !this.listStarted) void this.loadList(); };
  selectOrder = (order:OpeningOrder) => { if (!this.interactive() || this.state.submitting || this.needsRetry()) return;this.patch({ selectedOrder:order.map.id,sourceNode:openingSourceStages(order,this.state.snapshot?.stage_states ?? {})[0]?.nodeId ?? '' });if (!this.requiresDiameter()) this.patch({ rolls:this.state.rolls.map(value => ({ ...value,diameter:'' })) }); };
  pickOrder = async () => { if (!this.interactive() || this.state.submitting || this.needsRetry() || !this.state.orders.length) return; const order = await this.presentations.request<OpeningOrder>('order',this.state.orders);if (order && this.current()) this.selectOrder(order); };
  sourceNode = (sourceNode:string) => { if (!this.interactive() || this.state.submitting || this.needsRetry()) return;this.patch({ sourceNode });if (!this.requiresDiameter()) this.patch({ rolls:this.state.rolls.map(value => ({ ...value,diameter:'' })) }); };
  count = (value:string) => { if (!this.interactive() || this.state.submitting || this.needsRetry()) return; const rollCount = value.replace(/\D/g,''),count = /^\d+$/.test(rollCount) ? Number(rollCount) : 0,rolls = [...this.state.rolls];if (count >=1 && count<=500) { while (rolls.length<count) rolls.push(roll());rolls.length = count; }this.patch({ rollCount,rolls }); };
  metric = (index:number,field:keyof OpeningRoll,value:string) => { if (!this.interactive() || this.state.submitting || this.needsRetry()) return;this.patch({ rolls:this.state.rolls.map((roll,row) => row === index ? { ...roll,[field]:value.replace(/[^0-9.,]/g,'') } : roll) }); };
  basis = (basis:string) => { if (this.interactive() && !this.state.submitting && !this.needsRetry() && ['measured','estimated'].includes(basis)) this.patch({ basis:basis as AdminOpeningWipQuantityBasis }); };
  private validate() { const validation:Record<string,string> = {},count = Number(this.state.rollCount);if (!/^\d+$/.test(this.state.rollCount) || count<1 || count>500) validation.count = this.a('production.opening_wip.invalid_roll_count');if (!this.state.sourceNode.trim()) validation.source = this.a('production.opening_wip.required');this.state.rolls.forEach((roll,index) => { for (const field of ['meter','kg','bobina',...(this.requiresDiameter() ? ['diameter'] : [])] as (keyof OpeningRoll)[]) { const value = parse(roll[field]);if (value === null || value<=0) validation[`${index}:${field}`] = this.a('production.opening_wip.invalid_quantity'); } });this.patch({ validation });return !Object.keys(validation).length; }
  private currentFingerprint() { return [this.order()!.map.id.trim(),this.source()!.apparatusId!.trim(),this.source()!.nodeId,String(Number(this.state.rollCount)),this.state.basis,this.state.rolls.map(roll => [roll.meter.trim(),roll.kg.trim(),roll.bobina.trim(),roll.diameter.trim()].join(',')).join(';')].join('|'); }
  submit = async () => {
    if (!this.interactive() || this.state.submitting) return; const retry = this.needsRetry(),created = this.state.created;if (!retry && !this.validate()) return;
    const source = this.source();if (!retry && !source) { this.patch({ submitError:this.a('production.opening_wip.location_missing') });return; }
    let force = false;if (!retry && created && this.currentFingerprint() === this.fingerprint) { if (await this.presentations.request<boolean>('duplicate',null) !== true || !this.current()) return;force = true; }
    const printer = await this.print.pick();if (!printer || !this.current()) return;this.patch({ submitting:true,submitError:'' });
    try { let record = retry ? created : null;if (!record) {
        const order = this.order()!,stage = this.source()!,sourceApparatus = stage.apparatusId!.trim(),fingerprint = this.currentFingerprint();if (force || !this.key || this.fingerprint !== fingerprint) { this.fingerprint = fingerprint;this.key = `mobile:opening-wip:${BigInt(nativeEpochMicroseconds()).toString(36)}`; }
        record = await adminCreateOpeningWip(this.session,{ idempotency_key:this.key,order_id:order.map.id,source_apparatus:sourceApparatus,source_stage_node_id:stage.nodeId,batches:this.state.rolls.slice(0,Number(this.state.rollCount)).map(roll => ({ quantity_basis:this.state.basis,finished_goods_meter:parse(roll.meter)!,finished_goods_kg:parse(roll.kg)!,bobina_kg:parse(roll.bobina)!,diameter:this.requiresDiameter() ? parse(roll.diameter) : null })) },this.guard);this.guard();
        if (record.intake.source_apparatus.trim() !== sourceApparatus || openingWipIntakeSourceStageNodeId(record.intake).trim() !== stage.nodeId.trim()) throw new MobileApiException({ code:'opening_wip_source_mismatch',message:'Tanlangan chiqish apparati serverda saqlanmadi. QR chop etilmadi.' });
        this.patch({ created:record,printed:new Set() });if (this.listStarted) void this.loadList();
      }
      for (const batch of record.batches) { if (this.state.printed.has(batch.batch_id)) continue;await this.print.batch(batch,printer);this.guard();this.patch({ printed:new Set([...this.state.printed,batch.batch_id]) }); }
    } catch (error) { this.patch({ submitError:sourceError(error) ?? this.a('production.opening_wip.print_failed',{ printed:this.state.printed.size,total:this.state.created?.batches.length ?? 0 }) }); }
    finally { this.patch({ submitting:false }); }
  };
  toggleFilter = () => { if (this.interactive()) this.patch({ expanded:!this.state.expanded }); };
  filter = (value:string) => { if (this.interactive()) this.patch({ filter:value.trim(),expanded:false }); };
  entries = () => { const records = activeOpeningRecords(this.state.records),options = [...new Set(records.map(openingWipSourceApparatus).filter(Boolean))].sort((a,b) => a.toLowerCase()<b.toLowerCase() ? -1 : a.toLowerCase()>b.toLowerCase() ? 1 : 0),selected = options.includes(this.state.filter) ? this.state.filter : '';return { options,selected,rows:records.flatMap(record => selected && openingWipSourceApparatus(record) !== selected ? [] : record.batches.filter(batch => batch.wip_status.trim().toLowerCase() !== 'void').map(batch => ({ record,batch }))) }; };
  details = async (entry:OpeningEntry) => { if (!this.interactive()) return;if (!entry.batch.qr_payload.trim()) { this.notice(this.a('production.opening_wip.reprint_qr_missing'));return; }this.patch({ reprintMessage:'' });await this.presentations.request('details',entry); };
  reprint = async (entry:OpeningEntry) => {
    if (!this.interactive() || this.state.reprinting) return;this.patch({ reprinting:entry.batch.batch_id,reprintMessage:'' });
    try { const printer = await this.print.pick();if (!printer || !this.current()) return;await this.print.batch(entry.batch,printer);this.guard();this.notice(this.a('production.opening_wip.reprint_success')); }
    catch (error) { this.patch({ reprintMessage:sourceError(error)?.trim() || (error instanceof Error ? error.message.trim() : '') || this.a('production.opening_wip.reprint_failed') }); }
    finally { this.patch({ reprinting:'' }); }
  };
  remove = async (entry:OpeningEntry) => { if (!this.interactive() || this.state.deleting) return;const canDelete = openingWipBatchCanDelete(entry.batch);if (await this.presentations.request<boolean>('delete',{ entry,canDelete }) !== true || !this.current()) return;if (!canDelete) { this.notice(this.a('wip.delete.locked'));return; }this.patch({ deleting:entry.batch.batch_id });try { await adminDeleteOpeningWipBatch(this.session,entry.batch.batch_id,this.guard);this.guard();await this.loadList();if (this.current()) this.notice(this.a('wip.delete.success')); }catch (error) { if (this.current()) this.notice(sourceError(error) ?? this.a('wip.delete.failed')); }finally { this.patch({ deleting:'' }); } };
  override dispose() { super.dispose();this.generation++;this.listGeneration++;this.presentations.dispose(); }
}
