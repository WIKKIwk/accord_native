import { useMaterialColors } from '@expo/ui/jetpack-compose';
import { SymbolView } from 'expo-symbols';
import { useEffect, useSyncExternalStore, type ReactNode } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { useSharedValue } from 'react-native-reanimated';
import { WorkerQueueCard } from '../components/WorkerQueueCard.android';
import { usePreparationText } from '../preparation/PreparationUI.android';
import { OrdersList } from '../shared/orders/OrdersList';
import { rawSplitHistorySubtitle, rawSplitHistoryTime, rawSplitHistoryTitle, rawSplitIssueTime } from './rawSplitHistoryPresentation';
import type { RawSplitHistoryViewProps } from './rawSplitHistoryViewTypes';

const passthrough = () => true;
export function RawSplitHistory({ controller, onResult, onIssue }: RawSplitHistoryViewProps) {
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  const colors = useMaterialColors(), headerOffset = useSharedValue(0), headerHeight = useSharedValue(0), t = usePreparationText();
  useEffect(() => { void controller.reload(); }, [controller]);
  const history = state.snapshot?.history ?? [], issues = state.snapshot?.issues ?? [];
  const isEmpty = history.length === 0 && issues.length === 0;
  const primary = { color: colors.onSurface }, secondary = { color: colors.onSurfaceVariant };
  const rows: ReactNode[] = [];
  if (state.error) rows.push(<WorkerQueueCard key="error" first last backgroundColor={colors.surface}
    onPress={() => { void controller.reload(); }}><View style={{ padding: 8 }}>
    <Text style={primary}>Tarix yuklanmadi</Text><Text style={secondary}>{state.error}</Text></View></WorkerQueueCard>);
  else if (!state.snapshot) rows.push(<ActivityIndicator key="loading" />);
  else if (isEmpty) rows.push(<WorkerQueueCard key="empty" first last backgroundColor={colors.surface}>
    <Text style={[primary, { padding: 8 }]}>Hali bo‘lish tarixi yo‘q.</Text></WorkerQueueCard>);
  else {
    if (state.printer) rows.push(<WorkerQueueCard key="printer" first last backgroundColor={colors.surface}><View style={{ padding: 8 }}>
      <Text style={primary}>Printer: {state.printer.transport}</Text>{state.printer.transport === 'wifi' &&
        <Text style={secondary}>Wi-Fi printer: {state.wifiPrinter}</Text>}
    </View></WorkerQueueCard>);
    rows.push(...history.map((result, index) => <WorkerQueueCard key={`result:${result.id}`} first={index === 0} last={index === history.length - 1}
      backgroundColor={colors.surface} onPress={() => onResult(result)}><SymbolView name={{ android: 'content_cut' }} size={22} tintColor={colors.primary} />
    <View style={{ flex: 1, padding: 8 }}><Text style={primary} numberOfLines={1}>{rawSplitHistoryTitle(result)}</Text>
      <Text style={secondary} numberOfLines={2}>{rawSplitHistorySubtitle(result)}</Text></View>
    <View style={{ alignItems: 'flex-end' }}><Text style={secondary}>{rawSplitHistoryTime(result.createdAt)}</Text>
      <SymbolView name={{ android: 'chevron_right' }} size={20} tintColor={colors.onSurfaceVariant} /></View></WorkerQueueCard>));
  }
  if (issues.length) rows.push(<View key="issues" style={{ paddingHorizontal: 16, paddingTop: 20, paddingBottom: 8 }}>
    <Text style={primary}>{t('Muammolar')}</Text></View>);
  rows.push(...issues.map((issue, index) => <WorkerQueueCard key={`issue:${issue.id}`} first={index === 0} last={index === issues.length - 1}
    backgroundColor={colors.surface} onPress={() => onIssue(issue, history.some(result => result.issueId === issue.id))}>
    <SymbolView name={{ android: 'warning_amber' }} size={22} tintColor={colors.primary} />
    <View style={{ flex: 1, padding: 8 }}><Text style={primary} numberOfLines={1}>{issue.source.itemName}</Text>
      <Text style={secondary} numberOfLines={2}>{issue.check.message}</Text></View>
    <View style={{ alignItems: 'flex-end' }}><Text style={secondary}>{t(rawSplitIssueTime(issue))}</Text>
      <SymbolView name={{ android: 'chevron_right' }} size={20} tintColor={colors.onSurfaceVariant} /></View>
  </WorkerQueueCard>));
  return <OrdersList onRefresh={() => controller.reload()} active headerOffset={headerOffset} headerHeight={headerHeight} topInset={8}
    passthrough={passthrough}>{rows}</OrdersList>;
}
