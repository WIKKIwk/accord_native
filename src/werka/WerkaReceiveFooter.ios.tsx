import { Button, Menu, ProgressView, Section, Text } from '@expo/ui/swift-ui';
import { disabled } from '@expo/ui/swift-ui/modifiers';
import { uiText } from '../shared/localization';
import { werkaReceiveFooterActions, type WerkaReceiveFooterProps } from './werkaReceiveFooterModel';

/** A native footer only: the caller owns confirmation, mutation and navigation. */
export function WerkaReceiveFooter(props: WerkaReceiveFooterProps) {
  const { state } = props, actions = werkaReceiveFooterActions(props), t = (value: string) => uiText(value, props.locale);
  return <>
    {state.busy && !props.confirming ? <Section><ProgressView /></Section> : null}
    {props.error ? <Section><Text>{props.error}</Text></Section> : null}
    {props.beforeReceipt}
    {state.receipt !== null ? <Section><Text>{t('Omborga kirim qilingan')}</Text>
      <Text>{t(`Ombor: ${props.receiptWarehouse}`)}</Text><Text>{t(`Qabul qildi: ${props.receiptAcceptedBy}`)}</Text></Section>
      : <Section>{props.warning ? <Text>{t(props.warning)}</Text> : null}
        <Menu label={`${t('Qabul qiluvchi ombor')}: ${state.warehouse === null ? '—' : props.warehouseLabel(state.warehouse)}`}
          modifiers={[disabled(!actions.canSelect)]}>
          {props.warehouses.map((warehouse, index) => <Button key={`${warehouse}:${index}`} label={props.warehouseLabel(warehouse)}
            onPress={() => { if (actions.canSelect) props.onWarehouse(warehouse); }} />)}
        </Menu><Button label={t('Omborga kirim qilish')} modifiers={[disabled(!actions.canReceive)]}
          onPress={() => { if (actions.canReceive) props.onRequestReceive(); }} /></Section>}
    <Section><Button label={t('Qayta tekshirish')} modifiers={[disabled(!actions.canReload)]}
      onPress={() => { if (actions.canReload) props.onReload(); }} />
      <Button label={t('Keyingi QR kodni skanerlash')} modifiers={[disabled(!actions.canNext)]}
        onPress={() => { if (actions.canNext) props.onNextQr(); }} /></Section>
  </>;
}
