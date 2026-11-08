import { Text } from '@expo/ui';
import { Button, Host, HStack, List, Section, VStack } from '@expo/ui/swift-ui';
import { buttonStyle, contentShape, fixedSize, font, foregroundStyle, frame, lineLimit, listStyle, padding, refreshable, shapes } from '@expo/ui/swift-ui/modifiers';
import { PlatformColor } from 'react-native';
import { useCustomerText } from './CustomerContext';
import { CustomerEmptyStatusState, CustomerLoadingState, CustomerRetryState } from './CustomerStates';
import { CustomerStatusPanel } from './CustomerStatusPanel';
import { customerHomeRecord, customerLayoutDirection, customerStatusRecord } from './customerPresentation';
import type { CustomerStatusKind } from './customerStore';
import { useCustomerHome, useCustomerStatus } from './useCustomerScreens';

type HomeProps = { onOpenStatus: (kind: CustomerStatusKind) => void; onOpenDetail: (id: string) => void };
type StatusProps = { kind: CustomerStatusKind; onOpenDetail: (id: string) => void };

// @v2 CustomerHomeScreen
export function CustomerHomeScreen({ onOpenStatus, onOpenDetail }: HomeProps) {
  const state = useCustomerHome(), { locale, text } = useCustomerText();
  if (!state.loaded) return state.loading || state.error == null ? <CustomerLoadingState /> : <CustomerRetryState retry={state.refresh} />;
  return <Host style={{ flex: 1 }} layoutDirection={customerLayoutDirection(locale)}><List modifiers={[listStyle('insetGrouped'), refreshable(state.refresh)]}>
    <CustomerStatusPanel summary={state.summary} onOpenStatus={onOpenStatus} />
    <Section title={text('recentShipmentsTitle')}>
      {state.records.length === 0 ? <Text>{text('noShipments')}</Text> : state.records.map(record => {
        const row = customerHomeRecord(record);
        return <Button key={record.id} onPress={() => onOpenDetail(record.id)} modifiers={[buttonStyle('plain')]}>
          <HStack alignment="center" spacing={16} modifiers={[frame({ maxWidth: Infinity, alignment: 'leading' }),
            foregroundStyle(PlatformColor('label')), contentShape(shapes.rectangle())]}>
            <VStack alignment="leading" spacing={3} modifiers={[frame({ maxWidth: Infinity, alignment: 'leading' })]}>
              <Text numberOfLines={1} modifiers={[font({ textStyle: 'body', weight: 'medium' }), fixedSize({ horizontal: false, vertical: true })]}>{row.name}</Text>
              <Text numberOfLines={1} modifiers={[font({ textStyle: 'caption' }), foregroundStyle({ type: 'color', color: 'secondaryLabel' }),
                fixedSize({ horizontal: false, vertical: true })]}>{row.code}</Text>
            </VStack>
            <Text modifiers={[font({ textStyle: 'subheadline', weight: 'semibold' }), foregroundStyle({ type: 'color', color: 'secondaryLabel' }),
              fixedSize({ horizontal: true, vertical: true })]}>{row.quantity}</Text>
          </HStack>
        </Button>;
      })}
    </Section>
  </List></Host>;
}

// @v2 CustomerStatusDetailScreen
export function CustomerStatusDetailScreen({ kind, onOpenDetail }: StatusProps) {
  const state = useCustomerStatus(kind);
  if (!state.loaded) return state.loading || state.error == null ? <CustomerLoadingState /> : <CustomerRetryState retry={state.refresh} />;
  if (!state.records.length) return <CustomerEmptyStatusState />;
  return <Host style={{ flex: 1 }}><List modifiers={[listStyle('insetGrouped'), refreshable(state.refresh)]}>
    <Section>{state.records.map(record => {
      const row = customerStatusRecord(record);
      return <Button key={record.id} onPress={() => onOpenDetail(record.id)} modifiers={[buttonStyle('plain')]}>
        <VStack alignment="leading" spacing={0} modifiers={[frame({ maxWidth: Infinity, alignment: 'leading' }),
          foregroundStyle(PlatformColor('label')), contentShape(shapes.rectangle())]}>
          <HStack alignment="top" spacing={12}>
            <Text modifiers={[font({ textStyle: 'title3', weight: 'bold' }), lineLimit(), fixedSize({ horizontal: false, vertical: true }),
              frame({ maxWidth: Infinity, alignment: 'leading' })]}>{row.name}</Text>
            <Text modifiers={[font({ textStyle: 'caption' }), foregroundStyle(PlatformColor('secondaryLabel')), lineLimit(),
              fixedSize({ horizontal: true, vertical: true })]}>{row.created}</Text>
          </HStack>
          <Text modifiers={[font({ textStyle: 'title', weight: 'bold' }), lineLimit(), fixedSize({ horizontal: false, vertical: true }),
            padding({ top: 10 })]}>{row.quantity}</Text>
          {row.note ? <Text modifiers={[font({ textStyle: 'caption' }), foregroundStyle(PlatformColor('secondaryLabel')), lineLimit(),
            fixedSize({ horizontal: false, vertical: true }), padding({ top: 8 })]}>{row.note}</Text> : null}
        </VStack>
      </Button>;
    })}</Section>
  </List></Host>;
}
