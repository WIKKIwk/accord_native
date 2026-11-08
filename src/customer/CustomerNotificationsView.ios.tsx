import { Text } from '@expo/ui';
import { Button, Host, HStack, Image, List, Section, VStack } from '@expo/ui/swift-ui';
import { accessibilityHidden, background, buttonStyle, contentShape, fixedSize, font, foregroundStyle, frame, lineLimit,
  listRowBackground, listRowInsets, listStyle, padding, refreshable, shapes } from '@expo/ui/swift-ui/modifiers';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { PlatformColor, RefreshControl, ScrollView } from 'react-native';
import { WorkerAlert } from '../components/WorkerAlert';
import { useCustomerText } from './CustomerContext';
import { CustomerEmptyFeedState, CustomerLoadingState, CustomerRetryState } from './CustomerStates';
import { customerLayoutDirection, customerNotificationRecord } from './customerPresentation';
import { useCustomerNotifications } from './useCustomerScreens';

type Props = { onOpenDetail: (id: string) => void; onClearActionChanged?: (action: (() => void) | null) => void };

// @v2 CustomerNotificationsScreen
export function CustomerNotificationsScreen({ onOpenDetail, onClearActionChanged }: Props) {
  const state = useCustomerNotifications(), { locale, text } = useCustomerText(), [confirm, setConfirm] = useState(false);
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
  const showLoading = !state.loaded && state.records.length === 0 && state.loading;
  const showRetry = !state.loaded && state.records.length === 0 && !!state.error;
  return <>
    {showLoading ? <CustomerLoadingState /> : state.records.length === 0
      ? <ScrollView alwaysBounceVertical contentContainerStyle={{ flexGrow: 1, paddingTop: 8, paddingBottom: 24 }}
        refreshControl={<RefreshControl refreshing={state.loading} onRefresh={() => { void state.refresh(); }} />}>
        {showRetry ? <CustomerRetryState retry={state.refresh} /> : <CustomerEmptyFeedState />}
      </ScrollView>
      : <Host style={{ flex: 1 }} layoutDirection={customerLayoutDirection(locale)}><List modifiers={[listStyle('insetGrouped'), refreshable(state.refresh)]}>
        <Section title={text('shipmentsFlowTitle')}>{state.records.map(record => {
            const row = customerNotificationRecord(record), highlighted = state.highlightedIds.has(record.id);
            const symbol = row.icon === 'done' ? 'checkmark' : row.icon === 'close' ? 'xmark' : 'clock';
            return <Button key={record.id} onPress={() => { void open(record.id); }} modifiers={[buttonStyle('plain'),
              listRowInsets({ top: 0, leading: 0, bottom: 0, trailing: 0 }),
              ...(highlighted ? [listRowBackground(PlatformColor('secondarySystemFill'))] : [])]}>
              <HStack alignment="top" spacing={0} modifiers={[frame({ maxWidth: Infinity, alignment: 'leading' }), padding({ all: 16 }),
                foregroundStyle(PlatformColor('label')), contentShape(shapes.rectangle())]}>
                <Image systemName={symbol} size={20} modifiers={[frame({ width: 40, height: 40 }),
                  foregroundStyle(PlatformColor(highlighted ? 'label' : 'secondaryLabel')),
                  background(PlatformColor(highlighted ? 'secondarySystemFill' : 'tertiarySystemFill'), shapes.roundedRectangle({ cornerRadius: 12 })),
                  accessibilityHidden()]} />
                <VStack alignment="leading" spacing={0} modifiers={[frame({ maxWidth: Infinity, alignment: 'leading' }), padding({ leading: 14 })]}>
                  <Text modifiers={[font({ textStyle: 'body', weight: 'medium' }), lineLimit(), fixedSize({ horizontal: false, vertical: true })]}>{row.name}</Text>
                  <Text numberOfLines={1} modifiers={[font({ textStyle: 'caption' }), foregroundStyle(PlatformColor('secondaryLabel')),
                    padding({ top: 4 })]}>{row.code}</Text>
                  <Text numberOfLines={2} modifiers={[font({ textStyle: 'caption' }), foregroundStyle(PlatformColor('secondaryLabel')),
                    padding({ top: 8 })]}>{row.body}</Text>
                </VStack>
                <Text modifiers={[font({ textStyle: 'caption' }), foregroundStyle(PlatformColor('secondaryLabel')), lineLimit(),
                  fixedSize({ horizontal: true, vertical: true }), padding({ leading: 12 })]}>{row.created}</Text>
              </HStack>
            </Button>;
          })}</Section>
      </List></Host>}
    <WorkerAlert alert={confirm ? { title: text('clearTitle'), message: text('clearAllNotificationsPrompt'),
      cancelLabel: text('no'), confirmLabel: text('yes'), onConfirm: () => { void state.clearAll(); } } : null} onDismiss={() => setConfirm(false)} />
  </>;
}
