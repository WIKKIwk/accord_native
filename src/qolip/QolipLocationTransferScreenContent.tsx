import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import { useWorkerColors } from '../components/useWorkerColors';
import { WorkerSheetButton } from '../components/WorkerSheetButton';
import { QolipFormField, QolipFormSelect } from './QolipFormControls';
import { localizedGetter, localizedMethod } from '../shared/localization';
import { useQolipText } from './useQolipText';
import { useQolipLocationTransfer } from './useQolipLocationTransfer';
/** @v2 QolipLocationTransferScreen */
export function QolipLocationTransferScreenContent() {
  const state = useQolipLocationTransfer(), c = state.controller, t = state.text, colors = useWorkerColors(), { locale } = useQolipText();
  if (state.loading) return <ActivityIndicator />;
  if (state.error) return <View style={{ padding: 24, gap: 16 }}><Text style={{ color: colors.muted, textAlign: 'center' }}>{localizedGetter('serverDisconnectedRetry', locale)}</Text><WorkerSheetButton label={localizedGetter('retry', locale)} onPress={() => { void c.reload(); }} /></View>;
  if (!state.data?.blocks.length) return <Text style={{ color: colors.text, padding: 24 }}>{t('transfer.empty')}</Text>;
  return <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 12, paddingBottom: 24 }}><View style={{ backgroundColor: colors.surface, borderRadius: 16, padding: 16, gap: 14 }}>
    <Text style={{ color: colors.text, fontSize: 18, fontWeight: '600' }}>{t('transfer.heading')}</Text><Text style={{ color: colors.icon }}>{t('transfer.description')}</Text>
    <QolipFormSelect label={t('transfer.source_block')} value={state.sourceBlock} options={state.data.blocks.map(block => ({ value: block.name, label: block.name }))} disabled={state.saving} onChange={name => { void c.selectSourceBlock(name); }} />
    {state.locationsLoading && !state.locations.length && <ActivityIndicator />}{state.locationsError && <View style={{ padding: 24, gap: 16 }}><Text style={{ color: colors.muted, textAlign: 'center' }}>{localizedGetter('serverDisconnectedRetry', locale)}</Text><WorkerSheetButton label={localizedGetter('retry', locale)} onPress={() => { void c.loadLocations(); }} /></View>}
    {!state.locationsError && !(state.locationsLoading && !state.locations.length) && <QolipFormSelect label={t('transfer.source_mold')} value={state.source?.id ?? ''} options={state.locations.filter(row => row.quantity > 0).map(row => ({ value: row.id,
      label: (row.item_name.trim() || row.qolip_code) + ' • ' + row.qolip_code + ' • ' + (row.location_label.trim() || t('home.unplaced')) + ' • ' + localizedMethod('qolipCount', locale, { count: row.quantity }) }))} disabled={state.saving} onChange={id => c.selectSource(id)} />}
    {state.source && <><QolipFormSelect label={t('transfer.target_block')} value={state.targetBlocks.find(block => block.name.trim().toLowerCase() === state.targetBlock.trim().toLowerCase())?.name ?? ''} options={state.targetBlocks.map(block => ({ value: block.name, label: block.name }))} disabled={state.saving} onChange={name => c.selectTargetBlock(name)} />
      <WorkerSheetButton label={state.cell ? t('transfer.cell', { cell: state.cell }) : t('transfer.select_cell')} onPress={() => { void state.pickCell(); }} disabled={state.saving || !state.targetBlocks.some(block => block.name.trim().toLowerCase() === state.targetBlock.trim().toLowerCase())} height={54} />
      <QolipFormField label={t('transfer.quantity')} value={state.quantity} numeric disabled={state.saving} onChange={value => c.setQuantity(value)} />
      <Text style={{ color: colors.icon }}>{t('transfer.max_quantity', { count: state.source.quantity })}</Text>
      <WorkerSheetButton label={t(state.saving ? 'transfer.moving' : 'transfer.move')} variant="filled" disabled={state.saving} height={54} onPress={() => { void c.transfer(); }} />
    </>}
  </View></ScrollView>;
}
