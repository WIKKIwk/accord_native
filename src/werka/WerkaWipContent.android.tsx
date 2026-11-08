import { useMaterialColors } from '@expo/ui/jetpack-compose';
import { ActivityIndicator, ScrollView, View } from 'react-native';
import { WorkerSheetButton } from '../components/WorkerSheetButton';
import { PreparationRow, PreparationText } from '../preparation/PreparationUI.android';
import { DropdownFilter } from '../shared/filters/DropdownFilter.android';
import { uiText } from '../shared/localization';
import { werkaWipContentActions, werkaWipLabel, werkaWipPresentation, type WerkaWipContentProps } from './werkaWipPresentation';

/** Partial body; shell, confirmation, guarded mutation and routes remain with the future screen. */
export function WerkaWipContent(props: WerkaWipContentProps) {
  const { preview, state } = props, view = werkaWipPresentation(preview, state), actions = werkaWipContentActions(props);
  const colors = useMaterialColors(), t = (value: string) => uiText(value, props.locale);
  const label = (value: string) => werkaWipLabel(value, preview.apparatusNames), receipt = state.receipt;
  const details = [t(view.order), t(view.qr), view.quantity, t(view.location), view.worker ? t(view.worker) : '', view.description, view.status].filter(Boolean).join('\n');
  return <ScrollView contentContainerStyle={{ paddingHorizontal: 8, paddingTop: 4, paddingBottom: 140, gap: 10 }}>
    {state.busy && !props.confirming ? <ActivityIndicator /> : null}
    {props.error ? <PreparationText>{t(props.error)}</PreparationText> : null}
    <PreparationRow title={view.product} subtitle={details} />
    {receipt !== null ? <PreparationRow title={t('Omborga kirim qilingan')}
      subtitle={[t(`Ombor: ${label(String(receipt.warehouse ?? ''))}`), t(`Qabul qildi: ${String(receipt.accepted_by_display_name ?? '')}`)].join('\n')} />
      : <><DropdownFilter label={t('Qabul qiluvchi ombor')} selectedLabel={state.warehouse === null ? '—' : label(state.warehouse)}
          options={preview.warehouses.map(value => ({ value, label: label(value) }))} enabled={actions.canSelect}
          backgroundColor={colors.surface} onChange={value => { if (actions.canSelect) props.onWarehouse(value); }} />
        <WorkerSheetButton label={t('Omborga kirim qilish')} variant="filled" disabled={!actions.canReceive}
          onPress={() => { if (actions.canReceive) props.onRequestReceive(); }} /></>}
    <View><WorkerSheetButton label={t('Qayta tekshirish')} variant="text" disabled={!actions.canReload}
      onPress={() => { if (actions.canReload) props.onReload(); }} /></View>
    <WorkerSheetButton label={t('Keyingi QR kodni skanerlash')} disabled={!actions.canNext}
      onPress={() => { if (actions.canNext) props.onNextQr(); }} />
  </ScrollView>;
}
