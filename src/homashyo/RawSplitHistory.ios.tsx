import { Button, HStack, Image, ProgressView, Section, Text, VStack } from '@expo/ui/swift-ui';
import { disabled, lineLimit } from '@expo/ui/swift-ui/modifiers';
import { useLayoutEffect, useSyncExternalStore } from 'react';
import { PreparationList, usePreparationText } from '../preparation/PreparationUI';
import { rawSplitHistorySubtitle, rawSplitHistoryTime, rawSplitHistoryTitle, rawSplitIssueTime } from './rawSplitHistoryPresentation';
import type { RawSplitHistoryViewProps } from './rawSplitHistoryViewTypes';

export function RawSplitHistory({ controller, onResult, onIssue }: RawSplitHistoryViewProps) {
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot), t = usePreparationText();
  // V2 starts the first reload in initState, before the initial frame.
  useLayoutEffect(() => { void controller.reload(); }, [controller]);
  const history = state.snapshot?.history ?? [], issues = state.snapshot?.issues ?? [];
  const isEmpty = history.length === 0 && issues.length === 0;
  return <PreparationList refresh={() => controller.reload()}>
    {state.error !== null ? <Section><Button modifiers={[disabled(state.busy)]} onPress={() => { if (!state.busy) void controller.reload(); }}>
      <HStack spacing={12}><Image systemName="exclamationmark.circle" size={22} /><VStack alignment="leading">
        <Text>Tarix yuklanmadi</Text>{!!state.error.trim() && <Text>{state.error.trim()}</Text>}</VStack></HStack></Button></Section>
      : state.snapshot === null && state.busy ? <Section><ProgressView /></Section>
      : isEmpty ? <Section><HStack spacing={12}><Image systemName="clock.arrow.circlepath" size={22} /><Text>Hali bo‘lish tarixi yo‘q.</Text></HStack></Section>
      : <>
        {state.printer && <Section><HStack spacing={12}><Image systemName="printer" size={22} /><VStack alignment="leading">
          <Text>Printer: {state.printer.transport}</Text>{state.printer.transport === 'wifi' &&
            <Text>Wi-Fi printer: {state.wifiPrinter}</Text>}</VStack></HStack></Section>}
        {!!history.length && <Section>{history.map(result => <Button key={result.id} onPress={() => onResult(result)}>
          <HStack spacing={10}><Image systemName="scissors" size={22} /><VStack alignment="leading">
            <Text modifiers={[lineLimit(1)]}>{rawSplitHistoryTitle(result)}</Text>
            <Text modifiers={[lineLimit(2)]}>{rawSplitHistorySubtitle(result)}</Text></VStack>
            <VStack alignment="trailing"><Text>{rawSplitHistoryTime(result.createdAt)}</Text><Image systemName="chevron.right" size={20} /></VStack></HStack>
        </Button>)}</Section>}
      </>}
    {!!issues.length && <Section title={t('Muammolar')}>{issues.map(issue => <Button key={issue.id}
      onPress={() => onIssue(issue, history.some(result => result.issueId === issue.id))}>
      <HStack spacing={10}><Image systemName="exclamationmark.triangle" size={22} /><VStack alignment="leading">
        <Text modifiers={[lineLimit(1)]}>{issue.source.itemName}</Text><Text modifiers={[lineLimit(2)]}>{issue.check.message}</Text></VStack>
        <VStack alignment="trailing"><Text>{t(rawSplitIssueTime(issue))}</Text><Image systemName="chevron.right" size={20} /></VStack></HStack>
    </Button>)}</Section>}
  </PreparationList>;
}
