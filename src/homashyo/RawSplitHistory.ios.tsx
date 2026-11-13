import { Button, Host, HStack, Image, List, ProgressView, Section, Text, VStack } from '@expo/ui/swift-ui';
import { disabled, lineLimit, font, foregroundStyle, frame, padding, buttonStyle, listStyle, listRowInsets, listRowSeparator, listRowBackground, listRowSpacing, refreshable, background, shapes } from '@expo/ui/swift-ui/modifiers';
import { useLayoutEffect, useSyncExternalStore } from 'react';
import { useBaseTheme } from '../components/useBaseTheme';
import { usePreparationText } from '../preparation/PreparationUI';
import { rawSplitHistorySubtitle, rawSplitHistoryTime, rawSplitHistoryTitle, rawSplitIssueTime } from './rawSplitHistoryPresentation';
import type { RawSplitHistoryViewProps } from './rawSplitHistoryViewTypes';

// @v2 RawMaterialSplitHistoryScreen
export function RawSplitHistory({ controller, onResult, onIssue }: RawSplitHistoryViewProps) {
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot), t = usePreparationText();
  // V2 starts the first reload in initState, before the initial frame.
  useLayoutEffect(() => { void controller.reload(); }, [controller]);
  const history = state.snapshot?.history ?? [], issues = state.snapshot?.issues ?? [];
  const isEmpty = history.length === 0 && issues.length === 0;
  const { colors } = useBaseTheme();
  const titleFont = font({ textStyle: 'subheadline', size: 14, weight: 'bold' });
  const secondary = foregroundStyle(colors.onSurfaceVariant), primary = foregroundStyle(colors.onSurface);
  const card = [frame({ maxWidth: Infinity, alignment: 'leading' }), padding({ leading: 16, trailing: 12, vertical: 13 }), background(colors.surfaceContainerLowest, shapes.roundedRectangle({ cornerRadius: 18 }))];
  const row = [buttonStyle('plain'), listRowInsets({ leading: 4, trailing: 4, top: 0, bottom: 0 }), listRowSeparator('hidden'), listRowBackground('clear')];
  return <Host style={{ flex: 1 }}><List modifiers={[listStyle('plain'), listRowSpacing(2), refreshable(() => controller.reload())]}>
    {state.error !== null ? <Section><Button modifiers={[disabled(state.busy)]} onPress={() => { if (!state.busy) void controller.reload(); }}>
      <HStack spacing={12}><Image systemName="exclamationmark.circle" size={22} /><VStack alignment="leading">
        <Text>Tarix yuklanmadi</Text>{!!state.error.trim() && <Text>{state.error.trim()}</Text>}</VStack></HStack></Button></Section>
      : state.snapshot === null && state.busy ? <Section><ProgressView /></Section>
      : isEmpty ? <Section><HStack spacing={12}><Image systemName="clock.arrow.circlepath" size={22} /><Text>Hali bo‘lish tarixi yo‘q.</Text></HStack></Section>
      : <>
        {state.printer && <Section><HStack spacing={12}><Image systemName="printer" size={22} /><VStack alignment="leading">
          <Text>Printer: {state.printer.transport}</Text>{state.printer.transport === 'wifi' &&
            <Text>Wi-Fi printer: {state.wifiPrinter}</Text>}</VStack></HStack></Section>}
        {!!history.length && <Section>{history.map(result => <Button key={result.id} modifiers={row} onPress={() => onResult(result)}>
          <HStack alignment="top" spacing={12} modifiers={card}><Image systemName="scissors" size={22} modifiers={[foregroundStyle(colors.primary)]} /><VStack alignment="leading" spacing={3} modifiers={[frame({ maxWidth: Infinity, alignment: 'leading' })]}>
            <Text modifiers={[lineLimit(1), titleFont, primary]}>{rawSplitHistoryTitle(result)}</Text>
            <Text modifiers={[lineLimit(2), font({ textStyle: 'caption' }), secondary]}>{rawSplitHistorySubtitle(result)}</Text></VStack>
            <VStack alignment="trailing" spacing={3}><Text modifiers={[font({ textStyle: 'caption2' }), secondary]}>{rawSplitHistoryTime(result.createdAt)}</Text><Image systemName="chevron.right" size={20} modifiers={[secondary]} /></VStack></HStack>
        </Button>)}</Section>}
      </>}
    {!!issues.length && <Section title={t('Muammolar')}>{issues.map(issue => <Button key={issue.id} modifiers={row}
      onPress={() => onIssue(issue, history.some(result => result.issueId === issue.id))}>
      <HStack alignment="top" spacing={12} modifiers={card}><Image systemName="exclamationmark.triangle" size={22} modifiers={[foregroundStyle(colors.primary)]} /><VStack alignment="leading" spacing={3} modifiers={[frame({ maxWidth: Infinity, alignment: 'leading' })]}>
        <Text modifiers={[lineLimit(1), titleFont, primary]}>{issue.source.itemName}</Text><Text modifiers={[lineLimit(2), font({ textStyle: 'caption' }), secondary]}>{issue.check.message}</Text></VStack>
        <VStack alignment="trailing" spacing={3}><Text modifiers={[font({ textStyle: 'caption2' }), secondary]}>{t(rawSplitIssueTime(issue))}</Text><Image systemName="chevron.right" size={20} modifiers={[secondary]} /></VStack></HStack>
    </Button>)}</Section>}
  </List></Host>;
}
