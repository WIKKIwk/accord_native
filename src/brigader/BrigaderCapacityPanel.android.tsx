import { View } from 'react-native';
import type { AdminApparatus } from '../apparatusApi';
import { adminText } from '../shared/localization';
import { Form, Label, Field, Toggle, Action, Select, Columns } from './BrigaderForm';
import { FeatureBusy, FeatureRow } from './BrigaderList';
import { BrigaderPresentationHost } from './BrigaderPresentationHost';
import { BrigaderDatePrompt } from './BrigaderDatePrompt';
import { useBrigaderCapacity } from './useBrigaderCapacity';
import { capacityTime } from './brigaderCapacityController';
export function BrigaderCapacityPanel({ apparatus, selector = true }: { apparatus: readonly AdminApparatus[]; selector?: boolean }) {
  const { page,owner,state } = useBrigaderCapacity(apparatus), a = (key: string) => adminText(key,page.locale), f = state.fields, selected = owner.selected();
  if (state.loading) return <FeatureBusy />;
  if (state.error) return <Form><Action label={state.error} onPress={() => { void owner.load(); }} /></Form>;
  const field = (key: keyof typeof f, label: string, numeric = false, readonly = false) => <Field label={a(label)} value={f[key]} numeric={numeric} disabled={readonly} onChange={value => owner.change(key,value)} />;
  return <View><Form><Label>{a('capacity.profile_title')}</Label><Label>{a('capacity.profile_description')}</Label>
    {selector ? <Select label={a('capacity.apparatus')} value={selected?.id ?? null} options={apparatus.map(item => ({ value:item.id,label:item.name }))} onChange={owner.select} /> : null}
    <Columns>{[field('slots','capacity.parallel_slots',true),field('efficiency','capacity.efficiency',true)]}</Columns><Columns>{[field('setup','capacity.setup_minutes',true),field('cleanup','capacity.cleanup_minutes',true)]}</Columns>
    <Toggle label={a('capacity.finite_title')} value={state.finite} disabled={state.saving} onChange={value => owner.toggle('finite',value)} /><Label>{a('capacity.finite_description')}</Label>
    {field('windows','capacity.working_windows')}<Label>{a('capacity.working_windows_help')}</Label>{field('capabilities','capacity.capabilities',false,true)}<Label>{a('apparatus.master_data_edit')}</Label>{field('notes','capacity.notes',false,true)}<Label>{a('apparatus.master_data_edit')}</Label>
    <Action label={a('capacity.save_profile')} disabled={!selected || state.saving} onPress={() => { void owner.save(); }} />
  </Form><Form><Label>{a('capacity.downtime_title')}</Label><Action label={a('action.save')} onPress={() => { void owner.downtime(); }} />
    <Action label={`${a('capacity.start')}\n${capacityTime(state.downtimeStart)}`} secondary onPress={() => { void owner.pickStart('downtimeStart'); }} />{field('downtimeHours','capacity.hours',true)}{field('downtimeReason','capacity.reason')}
    {state.snapshot.downtimes.filter(row => !selected || row.apparatus_id === selected.id).slice(0,8).map(row => <Label key={row.id}>{`${apparatus.find(item => item.id === row.apparatus_id)?.name ?? row.apparatus_id} • ${row.reason}\n${capacityTime(row.starts_at_unix*1000)} — ${capacityTime(row.ends_at_unix*1000)}`}</Label>)}
  </Form><Form><Label>{a('capacity.schedule_title')}</Label>
    <Select label={a('capacity.order')} value={state.orders.some(item => item.map.id === f.order) ? f.order : null} options={state.orders.map(item => ({ value:item.map.id,label:`${item.map.order_number.trim() || item.map.id} • ${item.map.title}` }))} onChange={value => owner.change('order',value)} />
    <Toggle label={a('capacity.alternatives_title')} value={state.alternatives} disabled={state.saving} onChange={value => owner.toggle('alternatives',value)} /><Label>{a(owner.candidates().length ? 'capacity.alternatives_hint' : 'capacity.alternatives_none')}</Label>
    {field('duration','capacity.duration',true)}<Action label={`${a('capacity.start')}\n${capacityTime(state.scheduleStart)}`} secondary onPress={() => { void owner.pickStart('scheduleStart'); }} />{field('requirements','capacity.requirements')}{field('reason','capacity.reason_priority')}
    <Action label={a('capacity.add_schedule')} disabled={!selected || state.saving} onPress={() => { void owner.schedule(); }} />
  </Form><Form><Label>{a('capacity.reservations_title')}</Label>{!state.snapshot.reservations.filter(row => !selected || row.apparatus_id === selected.id).length ? <Label>{a('capacity.reservations_empty')}</Label> : null}</Form>
    {state.snapshot.reservations.filter(row => !selected || row.apparatus_id === selected.id).map(row => <View key={row.reservation_id}><FeatureRow title={`${row.order_id} • ${apparatus.find(item => item.id === row.apparatus_id)?.name ?? row.apparatus_id}`} subtitle={`${capacityTime(row.starts_at_unix*1000)} — ${capacityTime(row.ends_at_unix*1000)} • ${row.status}`} />{row.status === 'planned' ? <Form><Action label={a('capacity.cancel')} onPress={() => { void owner.cancel(row); }} /></Form> : null}</View>)}
    <BrigaderPresentationHost owner={owner.presentations} render={(entry,interactive) => <BrigaderDatePrompt entry={entry} owner={owner.presentations} interactive={interactive} locale={page.locale} />} />
  </View>;
}
