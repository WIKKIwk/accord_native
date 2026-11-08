import { ListItem, Text } from '@expo/ui';
import { Button, Host, List, ProgressView, Section, VStack } from '@expo/ui/swift-ui';
import { listRowBackground, listStyle, refreshable } from '@expo/ui/swift-ui/modifiers';
import { SymbolView } from 'expo-symbols';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { PlatformColor } from 'react-native';
import { WorkerAlert } from '../components/WorkerAlert';
import { useCustomerText } from './CustomerContext';
import { customerNotificationRecord } from './customerPresentation';
import { useCustomerNotifications } from './useCustomerScreens';

type Props = { onOpenDetail: (id: string) => void; onClearActionChanged?: (action: (() => void) | null) => void };

// @v2 CustomerNotificationsScreen
export function CustomerNotificationsScreen({ onOpenDetail, onClearActionChanged }: Props) {
  const state = useCustomerNotifications(), { text } = useCustomerText(), [confirm, setConfirm] = useState(false);
  const mounted = useRef(false), focusGeneration = useRef(0);
  const openClear = useCallback(() => setConfirm(true), []);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useFocusEffect(useCallback(() => {
    const generation = ++focusGeneration.current;
    return () => { if (focusGeneration.current === generation) focusGeneration.current++; };
  }, []));
  useEffect(() => { onClearActionChanged?.(openClear); return () => { onClearActionChanged?.(null); }; }, [onClearActionChanged, openClear]);
  const open = async (id: string) => {
    const generation = focusGeneration.current;
    await state.markSeen(id);
    if (mounted.current && generation === focusGeneration.current) onOpenDetail(id);
  };
  const showLoading = !state.loaded && state.records.length === 0 && (state.loading || !state.error);
  const showRetry = !state.loaded && state.records.length === 0 && !state.loading && !!state.error;
  return <>
    <Host style={{ flex: 1 }}><List modifiers={[listStyle('insetGrouped'), refreshable(state.refresh)]}>
      {showLoading ? <ProgressView /> : showRetry ? <Section><Text>{text('serverDisconnectedRetry')}</Text>
        <Button label={text('retry')} onPress={() => { void state.refresh(); }} /></Section>
        : state.records.length === 0 ? <Section><Text>{text('noRecordsYet')}</Text></Section>
          : <Section title={text('shipmentsFlowTitle')}>{state.records.map(record => {
            const row = customerNotificationRecord(record), highlighted = state.highlightedIds.has(record.id);
            const symbol = row.icon === 'done' ? 'checkmark' : row.icon === 'close' ? 'xmark' : 'clock';
            return <ListItem key={record.id} onPress={() => { void open(record.id); }}
              modifiers={highlighted ? [listRowBackground(PlatformColor('secondarySystemFill'))] : undefined}
              leading={<SymbolView name={{ ios: symbol }} size={20} />} trailing={<Text>{row.created}</Text>}
              supportingText={<VStack alignment="leading"><Text>{row.code}</Text><Text>{row.body}</Text></VStack>}>
              <Text>{row.name}</Text></ListItem>;
          })}</Section>}
    </List></Host>
    <WorkerAlert alert={confirm ? { title: text('clearTitle'), message: text('clearAllNotificationsPrompt'),
      cancelLabel: text('no'), confirmLabel: text('yes'), onConfirm: () => { void state.clearAll(); } } : null} onDismiss={() => setConfirm(false)} />
  </>;
}
