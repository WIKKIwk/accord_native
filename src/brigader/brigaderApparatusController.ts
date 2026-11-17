import { dartFutureWait } from '../shared/dartFutureWait';
import { adminApparatus, type AdminApparatus } from '../apparatusApi';
import type { Session } from '../auth';
import { adminApparatusMasterOptions, apparatusKindsForFamily, type AdminApparatusMasterOptions } from '../admin/apparatusOptionsApi';
import { adminApparatusCollections, adminCreateApparatusCollection, adminUpdateApparatusCollection, adminDeleteApparatusCollection, type AdminApparatusCollection } from '../admin/apparatusCollection';
import { adminCreateApparatus, adminCanonicalApparatus, adminPatchCanonicalApparatus, adminTrainingApparatusModes, adminSetTrainingApparatusMode } from '../admin/canonicalApparatusMutationApi';
import { FactoryMapBindings, FactoryMapBindingFailure } from '../admin/factoryMapBindings';
import { canonicalFactoryMapObjectId } from '../admin/factoryMapMapping';
import { canonicalOperationForFamily } from '../admin/apparatusCanonicalDraft';
import { MobileApiException } from '../shared/mobileApiException';
import { adminText, productionText } from '../shared/localization';
import { BrigaderPresentations } from './brigaderPresentations';
import { BrigaderModel } from './brigaderModel';
export type ApparatusModule = 'hub'|'catalog'|'groups'|'queue'|'capacity';
type Editor = { current: AdminApparatus | null; name: string; family: string | null; kind: string | null; color: string; capabilities: string[] };
type CollectionEditor = { current: AdminApparatusCollection | null; name: string; selected: string[] };
type Cache = { apparatus: AdminApparatus[]; collections: AdminApparatusCollection[]; options: AdminApparatusMasterOptions; trainingAvailable: boolean };
type State = { module: ApparatusModule; loading: boolean; error: unknown; saving: boolean; apparatus: AdminApparatus[]; collections: AdminApparatusCollection[]; options: AdminApparatusMasterOptions | null; trainingAvailable: boolean; editor: Editor | null; collection: CollectionEditor | null; expanded: ReadonlySet<string> };
let warmCache: Cache | null = null;
const compare = (a: AdminApparatus,b: AdminApparatus) => a.sort_order-b.sort_order || a.name.toLowerCase().localeCompare(b.name.toLowerCase());
export class BrigaderApparatusController extends BrigaderModel<State> {
  readonly presentations = new BrigaderPresentations(this.current);
  readonly bindings: FactoryMapBindings;
  private loadGeneration = 0; private focusedOpened = false;
  constructor(private readonly session: Session, module: ApparatusModule, private readonly focusName: boolean, current: () => boolean, interactive: () => boolean, private readonly notice: (message: string,tone: 'error'|'success') => void, private readonly locale: () => string, private readonly onSaved?: (item: AdminApparatus) => void, seed?: Cache) {
    const initial = seed ?? warmCache;
    super({ module:focusName ? 'catalog' : module, loading:!initial, error:null, saving:false, apparatus:initial?.apparatus ?? [], collections:initial?.collections ?? [], options:initial?.options ?? null, trainingAvailable:initial?.trainingAvailable ?? false, editor:null,collection:null,expanded:new Set() },current,interactive);
    this.bindings = new FactoryMapBindings(() => adminApparatus(session,{ limit:500,beforeSend:this.guard }),id => adminCanonicalApparatus(session,id,this.guard),(item,objectId) => adminPatchCanonicalApparatus(session,item,{ placement:objectId ? { factory_map_object_id:objectId } : null },this.guard),this.current);
  }
  private a(key: string, values?: Record<string,unknown>) { return adminText(key,this.locale(),values); }
  private cache() { if (this.state.options) warmCache = { apparatus:this.state.apparatus,collections:this.state.collections,options:this.state.options,trainingAvailable:this.state.trainingAvailable }; }
  private failure(error: unknown,key: string) { this.notice(error instanceof MobileApiException ? error.message : this.a(key),'error'); }
  load = async (showLoading = !warmCache) => {
    if (!this.current() || this.bindings.saving) return; const generation = ++this.loadGeneration; if (showLoading) this.patch({ loading:true,error:null });
    try { let trainingAvailable = true; const modesFuture = adminTrainingApparatusModes(this.session,this.guard).catch(() => { trainingAvailable = false; return {} as Record<string,boolean>; });
      const [catalog,options,collections,modes] = await dartFutureWait([adminApparatus(this.session,{limit:500,beforeSend:this.guard}),adminApparatusMasterOptions(this.session),adminApparatusCollections(this.session),modesFuture] as const);
      if (!this.current() || generation !== this.loadGeneration) return;
      const apparatus = catalog.filter(item => item.lifecycle_state === 'active').map(item => ({ ...item,training_enabled:modes[item.id] ?? false })).sort(compare);
      this.patch({ apparatus,options,collections,trainingAvailable,loading:false,error:null }); this.cache(); this.maybeFocus();
    } catch (error) { if (this.current() && generation === this.loadGeneration) this.patch(warmCache ? { loading:false } : { loading:false,error }); }
  };
  maybeFocus() { if (this.current() && this.focusName && !this.focusedOpened && !this.state.loading) { this.focusedOpened = true; queueMicrotask(() => { if (this.current()) void this.edit(); }); } }
  module = (module: ApparatusModule) => { if (this.interactive()) this.patch({ module }); };
  latest = (item: AdminApparatus) => this.state.apparatus.find(row => row.id === item.id) ?? item;
  accept = (saved: AdminApparatus) => { if (this.current()) this.replace(saved); };
  private replace(saved: AdminApparatus) { this.patch({ apparatus:[...this.state.apparatus.filter(item => item.id !== saved.id),saved].sort(compare) }); this.cache(); this.onSaved?.(saved); }
  edit = async (current: AdminApparatus | null = null) => {
    if (!this.current() || this.state.saving || !this.state.options) return;
    this.patch({ editor:{ current,name:current?.name ?? '',family:current?.family === 'other' ? null : current?.family ?? null,kind:current?.kind === 'other' ? null : current?.kind ?? null,color:current?.color_stations?.toString() ?? '',capabilities:(current?.capabilities ?? []).filter(value => this.state.options!.capabilities.includes(value)) } });
    await this.presentations.request('editor',current); this.patch({ editor:null });
  };
  changeEditor = (field: 'name'|'family'|'kind'|'color', value: string) => { const editor = this.state.editor; if (!editor || !this.interactive()) return;
    const next = { ...editor,[field]:value }; if (field === 'family' && !apparatusKindsForFamily(this.state.options!,value).includes(editor.kind ?? '')) next.kind = null; this.patch({ editor:next });
  };
  capability = (code: string,value: boolean) => { const editor = this.state.editor; if (editor && !this.state.saving && this.interactive()) this.patch({ editor:{ ...editor,capabilities:value ? [...new Set([...editor.capabilities,code])] : editor.capabilities.filter(item => item !== code) } }); };
  saveEditor = async (id: number) => {
    const editor = this.state.editor,options = this.state.options; if (!editor || !options || this.state.saving || !this.interactive()) return;
    const name = editor.name.trim(),family = editor.family,kind = editor.kind; if (!name || family === null || kind === null) { this.notice(this.a('apparatus.kind_required'),'error'); return; }
    const operation = canonicalOperationForFamily(family); if (!operation) return;
    const color = editor.color.trim(),parsed = /^[+-]?\d+$/.test(color) ? Number(color) : null;
    if (kind === 'color_pechat' && (parsed === null || parsed < options.color_stations_min || parsed > options.color_stations_max)) { this.notice(this.a('apparatus.color_stations_range',{ min:options.color_stations_min,max:options.color_stations_max }),'error'); return; }
    const capabilities = [...new Set([...editor.capabilities,operation])], current = editor.current; this.patch({ saving:true });
    try { const saved = await adminCreateApparatus(this.session,{ name,id:current?.id ?? '',family,kind,capabilities,capability_profiles:capabilities.map(code => ({ code,level:current?.capability_profiles.find(row => row.code === code)?.level ?? 1,enabled:true,valid_from_unix:null,valid_to_unix:null })),color_stations:['color_pechat','flexo'].includes(kind) ? parsed : null,factory_map_object_id:current?.factory_map_object_id },this.guard);
      this.guard(); this.replace(saved); this.presentations.close(id); this.notice(this.a(current ? 'apparatus.master_saved' : 'apparatus.added'),'success');
    } catch (error) { if (this.current()) this.failure(error,'apparatus.add_failed'); } finally { this.patch({ saving:false }); }
  };
  editCollection = async (current: AdminApparatusCollection | null = null) => { if (!this.interactive() || this.state.saving) return; this.patch({ collection:{ current,name:current?.name ?? '',selected:[...(current?.apparatusIds ?? [])] } }); await this.presentations.request('collection',current); this.patch({ collection:null }); };
  collectionName = (name: string) => { if (this.interactive() && this.state.collection) this.patch({ collection:{ ...this.state.collection,name } }); };
  collectionMember = (id: string,selected: boolean) => { const editor = this.state.collection; if (!editor || this.state.saving || !this.interactive()) return; this.patch({ collection:{ ...editor,selected:selected ? [...new Set([...editor.selected,id])] : editor.selected.filter(value => value !== id) } }); };
  saveCollection = async (id: number) => {
    const editor = this.state.collection; if (!editor || this.state.saving || !this.interactive()) return; this.patch({ saving:true });
    try { this.guard(); const saved = editor.current ? await adminUpdateApparatusCollection(this.session,editor.current,editor.name,editor.selected) : await adminCreateApparatusCollection(this.session,editor.name,editor.selected); this.guard(); this.patch({ collections:[...this.state.collections.filter(item => item.id !== saved.id),saved].sort((a,b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase())) }); this.cache(); this.presentations.close(id); this.notice(this.a(editor.current ? 'apparatus.group_updated' : 'apparatus.group_added'),'success'); }
    catch (error) { if (this.current()) this.failure(error,'apparatus.group_save_failed'); } finally { this.patch({ saving:false }); }
  };
  deleteCollection = async (collection: AdminApparatusCollection) => {
    if (!this.interactive() || this.state.saving) return;
    if (await this.presentations.request<boolean>('deleteCollection',collection) !== true || !this.current()) return;
    this.patch({ saving:true }); try { await adminDeleteApparatusCollection(this.session,collection); this.guard(); this.patch({ collections:this.state.collections.filter(item => item.id !== collection.id) }); this.cache(); this.notice(this.a('apparatus.group_deleted'),'success'); }
    catch (error) { if (this.current()) this.failure(error,'apparatus.group_delete_failed'); } finally { this.patch({ saving:false }); }
  };
  toggleExpanded = (id: string) => { if (!this.interactive()) return; const expanded = new Set(this.state.expanded); if (!expanded.delete(id)) expanded.add(id); this.patch({ expanded }); };
  training = async (item: AdminApparatus,enabled: boolean) => { try { const current = this.latest(item); await adminSetTrainingApparatusMode(this.session,current,enabled,this.guard); this.guard(); const saved = { ...current,training_enabled:enabled }; this.replace(saved); this.notice(this.a(enabled ? 'apparatus.training_enabled' : 'apparatus.training_disabled'),'success'); return saved; } catch (error) { if (this.current()) this.failure(error,'apparatus.training_save_failed'); return null; } };
  materialAssignment = async (item: AdminApparatus,enabled: boolean) => { try { const saved = await adminPatchCanonicalApparatus(this.session,this.latest(item),{ worker_material_assignment_allowed:enabled },this.guard); this.guard(); this.replace(saved); return saved; } catch (error) { if (this.current()) this.notice(error instanceof MobileApiException ? error.message : productionText('worker.material_use.failed',this.locale()),'error'); return null; } };
  placement = async (item: AdminApparatus,objectId: string) => {
    if (this.bindings.saving) return null; ++this.loadGeneration; const normalized = canonicalFactoryMapObjectId(objectId.trim());
    try { const saved = await this.bindings.save(item,normalized); this.guard(); this.patch({ apparatus:[...this.bindings.apparatus] }); this.replace(saved); this.notice(this.a(normalized ? 'apparatus.map_assigned' : 'apparatus.map_removed'),'success'); return saved; }
    catch (error) { if (this.current()) this.notice(error instanceof FactoryMapBindingFailure ? this.a(`factory_map.binding_${error.reason}`) : error instanceof MobileApiException ? error.message : this.a('apparatus.map_save_failed'),'error'); return null; }
  };
  override dispose() { super.dispose(); this.loadGeneration++; this.bindings.dispose(); this.presentations.dispose(); }
}
export function canonicalApparatusGroups(source: readonly AdminApparatus[]) {
  const order = ['print','laminate','extrusion_lamination','cut','package','glue','unclassified'];
  return order.map(key => ({ key,apparatus:source.filter(item => { if (item.lifecycle_state !== 'active') return false; const operation = item.operation.trim().toLowerCase(),family = operation === 'laminate' && item.technology.trim().toLowerCase() === 'extrusion_lamination' ? 'extrusion_lamination' : operation; return (order.slice(0,-1).includes(family) ? family : 'unclassified') === key; }).sort(compare) })).filter(group => group.apparatus.length);
}
