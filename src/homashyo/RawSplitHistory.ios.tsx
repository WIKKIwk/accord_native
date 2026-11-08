import { Button, HStack, Image, ProgressView, Section, Text, VStack } from '@expo/ui/swift-ui';
import { lineLimit } from '@expo/ui/swift-ui/modifiers';
import { useEffect, useSyncExternalStore } from 'react';
import { PreparationList, usePreparationText } from '../preparation/PreparationUI';
import { rawSplitHistorySubtitle, rawSplitHistoryTime, rawSplitHistoryTitle, rawSplitIssueTime } from './rawSplitHistoryPresentation';
import type { RawSplitHistoryViewProps } from './rawSplitHistoryViewTypes';

export function RawSplitHistory({ controller, onResult, onIssue }: RawSplitHistoryViewProps) {
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot), t = usePreparationText();
  useEffect(() => { void controller.reload(); }, [controller]);
  const history = state.snapshot?.history ?? [], issues = state.snapshot?.issues ?? [];
  const isEmpty = history.length === 0 && issues.length === 0;
  return <PreparationList refresh={() => controller.reload()}>
    {state.error ? <Section><Button onPress={() => { void controller.reload(); }}><VStack alignment="leading">
      <Text>Tarix yuklanmadi</Text><Text>{state.error}</Text></VStack></Button></Section>
      : !state.snapshot ? <Section><ProgressView /></Section>
      : isEmpty ? <Section><Text>Hali bo‘lish tarixi yo‘q.</Text></Section>
      : <>
        {state.printer && <Section><Text>Printer: {state.printer.transport}</Text>{state.printer.transport === 'wifi' &&
          <Text>Wi-Fi printer: {state.wifiPrinter}</Text>}</Section>}
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
