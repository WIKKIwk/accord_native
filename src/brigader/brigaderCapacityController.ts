import { dartFutureWait } from '../shared/dartFutureWait';
import type { Session } from '../auth';
import type { AdminApparatus } from '../apparatusApi';
import { adminProductionMaps } from '../productionMapReadApi';
import { adminApparatusCapacitySnapshot, adminSaveApparatusCapacityProfile, adminSaveApparatusDowntime, adminScheduleApparatusOrder, adminCancelApparatusScheduleReservation } from '../admin/apparatusCapacityApi';
import type { AdminApparatusCapacitySnapshot, AdminApparatusScheduleReservation, AdminApparatusWorkingWindow } from '../admin/apparatusCapacityModel';
import { nextCanonicalMutationIdempotencyKey } from '../admin/canonicalApparatusMutationApi';
import { MobileApiException } from '../shared/mobileApiException';
import { adminText } from '../shared/localization';
import { BrigaderModel } from './brigaderModel';
import { BrigaderPresentations } from './brigaderPresentations';

type ProductionMapSaved = Awaited<ReturnType<typeof adminProductionMaps>>[number];
type Fields = { slots: string; setup: string; cleanup: string; efficiency: string; windows: string; capabilities: string; notes: string; order: string; duration: string; requirements: string; reason: string; downtimeHours: string; downtimeReason: string };
type State = { loading: boolean; error: string | null; saving: boolean; selected: string | null; snapshot: AdminApparatusCapacitySnapshot; orders: ProductionMapSaved[]; fields: Fields; finite: boolean; alternatives: boolean; scheduleStart: number; downtimeStart: number };
const integer = (value: string) => /^[+-]?\d+$/.test(value.trim()) ? Number(value.trim()) : null;
export function parseCapacityWindows(raw: string): AdminApparatusWorkingWindow[] | null {
  if (!raw.trim()) return [];
  const windows: AdminApparatusWorkingWindow[] = [];
  for (const token of raw.trim().split(/[;\n]/)) { const match = /^\s*([1-7])\s*:\s*(\d{1,4})\s*-\s*(\d{1,4})\s*$/.exec(token); if (!match) return null; const weekday = Number(match[1]), start_minute = Number(match[2]), end_minute = Number(match[3]); if (end_minute > 1440 || start_minute >= end_minute) return null; windows.push({ weekday, start_minute, end_minute }); }
  for (let day = 1; day <= 7; day++) { const rows = windows.filter(row => row.weekday === day).sort((a,b) => a.start_minute - b.start_minute); if (rows.some((row,index) => index > 0 && row.start_minute < rows[index-1].end_minute)) return null; }
  return windows;
}
function requirements(raw: string) { const result = new Map<string, number>(); for (const token of raw.split(/[,;\n]/)) { const parts = token.trim().split(':'), code = parts[0].trim().toLowerCase(); if (code) result.set(code, Math.max(1, Math.min(100, integer(parts[1] ?? '') ?? 1))); } return [...result].map(([code, min_level]) => ({ code, min_level })); }
/** @v2 _AdminApparatusCapacityPanelState */
export class BrigaderCapacityController extends BrigaderModel<State> {
  readonly presentations = new BrigaderPresentations(this.current);
  constructor(private readonly session: Session, public apparatus: readonly AdminApparatus[], current: () => boolean, interactive: () => boolean, private readonly notice: (text: string, tone: 'error'|'success') => void, private readonly locale: () => string) {
    super({ loading: true, error: null, saving: false, selected: apparatus[0]?.id ?? null, snapshot: { profiles: [], downtimes: [], reservations: [] }, orders: [], finite: true, alternatives: true, scheduleStart: Date.now(), downtimeStart: Date.now(), fields: { slots:'1', setup:'0', cleanup:'0', efficiency:'100', windows:'', capabilities:'', notes:'', order:'', duration:'60', requirements:'', reason:'', downtimeHours:'1', downtimeReason:'' } }, current, interactive);
  }
  updateApparatus(apparatus: readonly AdminApparatus[]) { this.apparatus = apparatus; }
  selected = () => this.apparatus.find(item => item.id === this.state.selected) ?? this.apparatus[0];
  private a(key: string) { return adminText(key, this.locale()); }
  private error(error: unknown) { this.notice(error instanceof MobileApiException ? error.message : this.a('capacity.action_failed'), 'error'); }
  load = async (showLoading = true) => { if (!this.current()) return; if (showLoading) this.patch({ loading: true, error: null }); try { const [snapshot, orders] = await dartFutureWait([adminApparatusCapacitySnapshot(this.session, this.guard), adminProductionMaps(this.session)] as const); this.guard(); this.patch({ snapshot, orders, loading: false, error: null }); this.applyProfile(); } catch { this.patch({ loading: false, error: this.a('capacity.load_failed') }); } };
  private applyProfile() {
    const item = this.selected(); if (!item) return; const profile = this.state.snapshot.profiles.find(row => row.apparatus_id === item.id);
    const levels = profile?.capability_levels ?? Object.fromEntries(item.capability_profiles.length ? item.capability_profiles.map(row => [row.code, row.level]) : item.capabilities.map(code => [code, 1]));
    this.patch({ finite: profile?.finite_capacity ?? true, fields: { ...this.state.fields, slots: String(profile?.capacity_slots ?? 1), setup: String(profile?.setup_minutes ?? 0), cleanup: String(profile?.cleanup_minutes ?? 0), efficiency: String(profile?.efficiency_percent ?? 100), windows: (profile?.working_windows ?? []).map(row => `${row.weekday}:${row.start_minute}-${row.end_minute}`).join('; '), capabilities: Object.entries(levels).map(([code,level]) => `${code}${level <= 1 ? '' : `:${level}`}`).join(', '), notes: profile?.notes ?? '' } });
  }
  select = (selected: string) => { if (this.interactive()) { this.patch({ selected }); this.applyProfile(); } };
  change = (field: keyof Fields, value: string) => { if (this.interactive() && !['capabilities','notes'].includes(field)) this.patch({ fields: { ...this.state.fields, [field]: value } }); };
  toggle = (field: 'finite'|'alternatives', value: boolean) => { if (this.interactive() && !this.state.saving) this.patch({ [field]: value }); };
  candidates = () => { const item = this.selected(); return this.apparatus.filter(row => row.id !== item?.id && !!item?.operation && row.operation === item.operation && row.technology === item.technology).map(row => ({ apparatus_id: row.id, apparatus: row.name })); };
  save = async () => {
    const item = this.selected(), f = this.state.fields; if (!item || !this.interactive() || this.state.saving) return;
    const slots = integer(f.slots), setup = integer(f.setup), cleanup = integer(f.cleanup), efficiency = integer(f.efficiency), windows = parseCapacityWindows(f.windows);
    if (slots === null || setup === null || cleanup === null || efficiency === null) { this.notice(this.a('capacity.value_invalid'), 'error'); return; }
    if (!windows) { this.notice(this.a('capacity.window_invalid'), 'error'); return; }
    this.patch({ saving: true }); const profile = this.state.snapshot.profiles.find(row => row.apparatus_id === item.id);
    try { await adminSaveApparatusCapacityProfile(this.session, { apparatus_id: item.id, apparatus: item.name, source_revision: profile?.source_revision ?? item.source_revision, source_aasx_sha256: profile?.source_aasx_sha256 ?? item.source_aasx_sha256, capacity_slots: slots, setup_minutes: setup, cleanup_minutes: cleanup, efficiency_percent: efficiency, finite_capacity: this.state.finite, working_windows: windows, capabilities: item.capabilities, capability_levels: Object.fromEntries(item.capability_profiles.map(row => [row.code,row.level])), notes: '', updated_at_unix: 0 }, { capacity: () => nextCanonicalMutationIdempotencyKey('capacity') }, this.guard); await this.load(false); if (this.current()) this.notice(this.a('capacity.profile_saved'), 'success'); } catch (error) { if (this.current()) this.error(error); } finally { this.patch({ saving: false }); }
  };
  schedule = async () => {
    const item = this.selected(), f = this.state.fields, duration = integer(f.duration), order = f.order.trim(); if (!this.interactive() || this.state.saving) return;
    if (!item || !order || duration === null || duration <= 0) { this.notice(this.a('capacity.order_required'), 'error'); return; }
    const candidates = this.state.alternatives ? this.candidates() : [], start = this.state.scheduleStart; this.patch({ saving: true });
    try { await adminScheduleApparatusOrder(this.session, { order_id: order, apparatus_id: item.id, apparatus: item.name, earliest_start_unix: Math.trunc(start / 1000), duration_minutes: duration, source: 'admin_capacity_panel', reason: f.reason, capability_requirements: requirements(f.requirements), candidate_apparatuses: candidates, idempotency_key: `admin:${order}:${item.id}:${start}:${candidates.map(row => row.apparatus_id).join(',')}` }, undefined, this.guard); await this.load(false); if (this.current()) this.notice(this.a('capacity.order_scheduled'), 'success'); } catch (error) { if (this.current()) this.error(error); } finally { this.patch({ saving: false }); }
  };
  cancel = async (reservation: AdminApparatusScheduleReservation) => { if (!this.interactive()) return; try { await adminCancelApparatusScheduleReservation(this.session, reservation.reservation_id, 'Admin jadvaldan bekor qildi', this.guard); await this.load(false); } catch (error) { if (this.current()) this.error(error); } };
  downtime = async () => {
    const item = this.selected(), f = this.state.fields, hours = Number(f.downtimeHours.trim()), reason = f.downtimeReason.trim(); if (!this.interactive()) return;
    if (!item || !f.downtimeHours.trim() || !Number.isFinite(hours) || hours <= 0 || !reason) { this.notice(this.a('capacity.downtime_required'), 'error'); return; }
    try { const start = this.state.downtimeStart; await adminSaveApparatusDowntime(this.session, { id:'', apparatus_id:item.id, apparatus:item.name, starts_at_unix:Math.trunc(start/1000), ends_at_unix:Math.trunc((start+Math.round(hours*60)*60000)/1000), reason, active:true, actor:{ role:'',ref:'',display_name:'' }, created_at_unix:0 }, this.guard); this.patch({ fields:{ ...this.state.fields,downtimeReason:'' } }); await this.load(false); if (this.current()) this.notice(this.a('capacity.downtime_saved'),'success'); } catch (error) { if (this.current()) this.error(error); }
  };
  pickStart = async (field: 'scheduleStart'|'downtimeStart') => {
    if (!this.interactive()) return; const initial = this.state[field], now = new Date(), min = new Date(now.getTime()-86400000), max = new Date(now.getTime()+366*86400000);
    const date = await this.presentations.request<number>('date', { initial, min, max }); if (date === undefined || !this.current()) return;
    const time = await this.presentations.request<number>('time', { initial }); if (time === undefined || !this.current()) return;
    const day = new Date(date), clock = new Date(time); this.patch({ [field]: new Date(day.getFullYear(),day.getMonth(),day.getDate(),clock.getHours(),clock.getMinutes()).getTime() });
  };
  override dispose() { super.dispose(); this.presentations.dispose(); }
}
export function capacityTime(value: number) { if (value <= 0) return '—'; const date = new Date(value), two = (value: number) => String(value).padStart(2,'0'); return `${two(date.getDate())}.${two(date.getMonth()+1)} ${two(date.getHours())}:${two(date.getMinutes())}`; }
