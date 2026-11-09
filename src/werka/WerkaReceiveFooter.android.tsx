import { useMaterialColors } from '@expo/ui/jetpack-compose';
import { ActivityIndicator, View } from 'react-native';
import { WorkerSheetButton } from '../components/WorkerSheetButton';
import { PreparationRow, PreparationText } from '../preparation/PreparationUI.android';
import { DropdownFilter } from '../shared/filters/DropdownFilter.android';
import { uiText } from '../shared/localization';
import { werkaReceiveFooterActions, type WerkaReceiveFooterProps } from './werkaReceiveFooterModel';

/** A native footer only: the caller owns confirmation, mutation and navigation. */
export function WerkaReceiveFooter(props: WerkaReceiveFooterProps) {
  const { state } = props, actions = werkaReceiveFooterActions(props), colors = useMaterialColors();
  const t = (value: string) => uiText(value, props.locale);
  return <>
    {state.busy && !props.confirming ? <ActivityIndicator /> : null}
    {props.error ? <PreparationText>{props.error}</PreparationText> : null}
    {props.beforeReceipt}
    {state.receipt !== null ? <PreparationRow title={t('Omborga kirim qilingan')}
      subtitle={[t(`Ombor: ${props.receiptWarehouse}`), t(`Qabul qildi: ${props.receiptAcceptedBy}`)].join('\n')} />
      : <>{props.warning ? <PreparationText>{t(props.warning)}</PreparationText> : null}
        <DropdownFilter label={t('Qabul qiluvchi ombor')} selectedLabel={state.warehouse === null ? '—' : props.warehouseLabel(state.warehouse)}
          options={props.warehouses.map(value => ({ value, label: props.warehouseLabel(value) }))} enabled={actions.canSelect}
          backgroundColor={colors.surface} onChange={value => { if (actions.canSelect) props.onWarehouse(value); }} />
        <WorkerSheetButton label={t('Omborga kirim qilish')} variant="filled" disabled={!actions.canReceive}
          onPress={() => { if (actions.canReceive) props.onRequestReceive(); }} /></>}
    <View><WorkerSheetButton label={t('Qayta tekshirish')} variant="text" disabled={!actions.canReload}
      onPress={() => { if (actions.canReload) props.onReload(); }} /></View>
    <WorkerSheetButton label={t('Keyingi QR kodni skanerlash')} disabled={!actions.canNext}
      onPress={() => { if (actions.canNext) props.onNextQr(); }} />
  </>;
}
