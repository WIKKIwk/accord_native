import { ListItem, Text } from '@expo/ui';
import { Button, Host, List, ProgressView, Section, VStack } from '@expo/ui/swift-ui';
import { listRowBackground, listStyle, refreshable } from '@expo/ui/swift-ui/modifiers';
import { PlatformColor } from 'react-native';
import { useCustomerText } from './CustomerContext';
import { customerHomeRecord, customerStatusRecord, customerStatusRows } from './customerPresentation';
import type { CustomerStatusKind } from './customerStore';
import { useCustomerHome, useCustomerStatus } from './useCustomerScreens';

type HomeProps = { onOpenStatus: (kind: CustomerStatusKind) => void; onOpenDetail: (id: string) => void };
type StatusProps = { kind: CustomerStatusKind; onOpenDetail: (id: string) => void };

function LoadingOrRetry({ loading, retry }: { loading: boolean; retry: () => Promise<void> }) {
  const { text } = useCustomerText();
  return <Host style={{ flex: 1 }}><VStack spacing={16}>
    {loading ? <ProgressView /> : <><Text>{text('serverDisconnectedRetry')}</Text><Button label={text('retry')} onPress={() => { void retry(); }} /></>}
  </VStack></Host>;
}

// @v2 CustomerHomeScreen
export function CustomerHomeScreen({ onOpenStatus, onOpenDetail }: HomeProps) {
  const state = useCustomerHome(), { text } = useCustomerText();
  if (!state.loaded) return <LoadingOrRetry loading={state.loading || !state.error} retry={state.refresh} />;
  return <Host style={{ flex: 1 }}><List modifiers={[listStyle('insetGrouped'), refreshable(state.refresh)]}>
    <Section>{customerStatusRows(state.summary).map(row => <ListItem key={row.kind} onPress={() => onOpenStatus(row.kind)}
      modifiers={row.kind === 'pending' ? [listRowBackground(PlatformColor('secondarySystemFill'))] : undefined} trailing={<Text>{String(row.count)}</Text>}><Text>{text(row.titleKey)}</Text></ListItem>)}</Section>
    <Section title={text('recentShipmentsTitle')}>
      {state.records.length === 0 ? <Text>{text('noShipments')}</Text> : state.records.map(record => {
        const row = customerHomeRecord(record);
        return <ListItem key={record.id} onPress={() => onOpenDetail(record.id)} supportingText={row.code}
          trailing={<Text>{row.quantity}</Text>}><Text>{row.name}</Text></ListItem>;
      })}
    </Section>
  </List></Host>;
}

// @v2 CustomerStatusDetailScreen
export function CustomerStatusDetailScreen({ kind, onOpenDetail }: StatusProps) {
  const state = useCustomerStatus(kind), { text } = useCustomerText();
  if (!state.loaded) return <LoadingOrRetry loading={state.loading || !state.error} retry={state.refresh} />;
  if (!state.records.length) return <Host style={{ flex: 1 }}><Text>{text('noRecordsYet')}</Text></Host>;
  return <Host style={{ flex: 1 }}><List modifiers={[listStyle('insetGrouped'), refreshable(state.refresh)]}>
    <Section>{state.records.map(record => {
      const row = customerStatusRecord(record);
      return <ListItem key={record.id} onPress={() => onOpenDetail(record.id)} trailing={<Text>{row.created}</Text>}
        supportingText={<VStack alignment="leading"><Text>{row.quantity}</Text>{row.note ? <Text>{row.note}</Text> : null}</VStack>}>
        <Text>{row.name}</Text>
      </ListItem>;
    })}</Section>
  </List></Host>;
}
