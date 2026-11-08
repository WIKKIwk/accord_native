import { Button, Menu, ProgressView, Section, Text, VStack } from '@expo/ui/swift-ui';
import { disabled } from '@expo/ui/swift-ui/modifiers';
import { PreparationList } from '../preparation/PreparationUI.ios';
import { uiText } from '../shared/localization';
import { werkaWipContentActions, werkaWipLabel, werkaWipPresentation, type WerkaWipContentProps } from './werkaWipPresentation';

/** Partial body; shell, confirmation, guarded mutation and routes remain with the future screen. */
export function WerkaWipContent(props: WerkaWipContentProps) {
  const { preview, state } = props, view = werkaWipPresentation(preview, state), actions = werkaWipContentActions(props);
  const t = (value: string) => uiText(value, props.locale), label = (value: string) => werkaWipLabel(value, preview.apparatusNames);
  const receipt = state.receipt;
  return <PreparationList>
    {state.busy && !props.confirming ? <Section><ProgressView /></Section> : null}
    {props.error ? <Section><Text>{t(props.error)}</Text></Section> : null}
    <Section><VStack alignment="leading" spacing={6}><Text>{view.product}</Text><Text>{t(view.order)}</Text>
      <Text>{t(view.qr)}</Text><Text>{view.quantity}</Text><Text>{t(view.location)}</Text>
      {view.worker ? <Text>{t(view.worker)}</Text> : null}{view.description ? <Text>{view.description}</Text> : null}
      <Text>{view.status}</Text></VStack></Section>
    {receipt !== null ? <Section><Text>{t('Omborga kirim qilingan')}</Text>
      <Text>{t(`Ombor: ${label(String(receipt.warehouse ?? ''))}`)}</Text>
      <Text>{t(`Qabul qildi: ${String(receipt.accepted_by_display_name ?? '')}`)}</Text></Section>
      : <Section><Menu label={`${t('Qabul qiluvchi ombor')}: ${state.warehouse === null ? '—' : label(state.warehouse)}`}
          modifiers={[disabled(!actions.canSelect)]}>
          {preview.warehouses.map((warehouse, index) => <Button key={`${warehouse}:${index}`} label={label(warehouse)}
            onPress={() => { if (actions.canSelect) props.onWarehouse(warehouse); }} />)}
        </Menu><Button label={t('Omborga kirim qilish')} modifiers={[disabled(!actions.canReceive)]}
          onPress={() => { if (actions.canReceive) props.onRequestReceive(); }} /></Section>}
    <Section><Button label={t('Qayta tekshirish')} modifiers={[disabled(!actions.canReload)]}
      onPress={() => { if (actions.canReload) props.onReload(); }} />
      <Button label={t('Keyingi QR kodni skanerlash')} modifiers={[disabled(!actions.canNext)]}
        onPress={() => { if (actions.canNext) props.onNextQr(); }} /></Section>
  </PreparationList>;
}
