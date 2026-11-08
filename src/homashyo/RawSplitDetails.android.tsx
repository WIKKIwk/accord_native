import { Host, IconButton, RNHostView, Row, Text as ComposeText, useMaterialColors } from '@expo/ui/jetpack-compose';
import { fillMaxWidth, semantics, weight, width } from '@expo/ui/jetpack-compose/modifiers';
import { SymbolView } from 'expo-symbols';
import { useEffect, useRef, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { WorkerSheetButton } from '../components/WorkerSheetButton';
import { PreparationText, usePreparationText } from '../preparation/PreparationUI.android';
import { DropdownFilter } from '../shared/filters/DropdownFilter.android';
import { rawSplitDisplay } from './rawSplitModel';
import { rawSplitHistorySubtitle, rawSplitHistoryTitle, rawSplitIssueDetailRows, rawSplitIssueFullTime, rawSplitOutputSummary, rawSplitResultDetailRows, type RawSplitDetailRow } from './rawSplitHistoryPresentation';
import type { RawSplitDetailsProps, RawSplitIssueDetailsProps } from './rawSplitDetailsTypes';

// @v2 _RawSplitDetailLine
function RawSplitDetailLine({ label, value }: RawSplitDetailRow) {
  const colors = useMaterialColors();
  return <Host matchContents={{ vertical: true }} style={{ width: '100%' }}><Row verticalAlignment="top" modifiers={[fillMaxWidth()]}>
    <ComposeText color={colors.onSurfaceVariant} style={{ typography: 'bodySmall', textAlign: 'start' }} modifiers={[width(104)]}>{label}</ComposeText>
    <ComposeText color={colors.onSurface} style={{ typography: 'bodySmall', fontWeight: '600', textAlign: 'start' }} modifiers={[weight(1)]}>{value}</ComposeText>
  </Row></Host>;
}

export function RawSplitDetails({ result, printerLabel, showWifiSelector, wifiPrinter, onSelectPrinter, onWifiChanged,
  onReprint, onReprintAll, onError }: RawSplitDetailsProps) {
  const colors = useMaterialColors(), [printing, setPrinting] = useState(false), inFlight = useRef(false), mounted = useRef(true), t = usePreparationText();
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const run = async (action: () => Promise<void>) => {
    if (inFlight.current) return;
    inFlight.current = true; setPrinting(true);
    try { await action(); } catch (error) { if (mounted.current) onError(error); } finally { inFlight.current = false; if (mounted.current) setPrinting(false); }
  };
  return <ScrollView contentContainerStyle={{ padding: 20, gap: 8, paddingBottom: 32 }}>
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
      <SymbolView name={{ android: 'content_cut' }} size={24} tintColor={colors.onSurfaceVariant} /><View style={{ flex: 1, gap: 4 }}>
        <PreparationText title>{rawSplitHistoryTitle(result)}</PreparationText><PreparationText>{rawSplitHistorySubtitle(result)}</PreparationText></View></View>
    {rawSplitResultDetailRows(result).map(row => <RawSplitDetailLine key={row.label} {...row} />)}
    {result.outputs.map(output => <View key={output.stockId} style={{ flexDirection: 'row', gap: 8 }}>
      <View style={{ flex: 1, gap: 3 }}><PreparationText>{t(rawSplitOutputSummary(output))}</PreparationText><PreparationText>{output.labelName}</PreparationText>
        {output.grossKg !== null && <PreparationText>{t(`Brutto: ${rawSplitDisplay(output.grossKg)} kg · Babina: ${rawSplitDisplay(output.bobinaKg!)} kg`)}</PreparationText>}
        {output.lengthM !== null && !!output.lengthM && <PreparationText>{t(`Metri: ${rawSplitDisplay(output.lengthM)} m`)}</PreparationText>}
        <Text selectable style={{ color: colors.onSurface }}>{output.barcode}</Text></View>
      <Host matchContents><IconButton enabled={!printing} onClick={() => { void run(() => onReprint(output)); }}
        modifiers={[semantics({ contentDescription: 'Shu rulonni qayta chop etish' })]}><RNHostView matchContents>
          <SymbolView name={{ android: 'print' }} size={22} tintColor={colors.onSurfaceVariant} />
        </RNHostView></IconButton></Host>
    </View>)}
    {printerLabel === null ? <WorkerSheetButton label={t('Printer tanlash')} disabled={printing} onPress={onSelectPrinter} /> :
      <><View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><SymbolView name={{ android: 'print' }} size={20} tintColor={colors.onSurfaceVariant} />
        <View style={{ flex: 1 }}><PreparationText>{t(`Printer: ${printerLabel}`)}</PreparationText></View></View>{showWifiSelector &&
        <DropdownFilter label="" selectedLabel={t(wifiPrinter === 'godex' ? 'GoDEX' : 'Zebra')} backgroundColor={colors.surface}
          enabled={!printing} options={[{ value: 'godex', label: t('GoDEX') }, { value: 'zebra', label: t('Zebra') }]} onChange={onWifiChanged} />}</>}
    <WorkerSheetButton label={t('Barchasini qayta chop etish')} variant="filled" disabled={printing} onPress={() => { void run(onReprintAll); }} />
  </ScrollView>;
}

export function RawSplitIssueDetails({ issue, hasResult }: RawSplitIssueDetailsProps) {
  const colors = useMaterialColors(), t = usePreparationText(), date = rawSplitIssueFullTime(issue);
  return <ScrollView contentContainerStyle={{ padding: 20, gap: 8, paddingBottom: 32 }}>
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
      <SymbolView name={{ android: 'warning_amber' }} size={24} tintColor={colors.onSurfaceVariant} /><View style={{ flex: 1, gap: 4 }}>
        <PreparationText title>{issue.source.itemName}</PreparationText><PreparationText>{issue.check.message}</PreparationText></View></View>
    {rawSplitIssueDetailRows(issue).map(row => <RawSplitDetailLine key={row.label} {...row} />)}
    <PreparationText>{t(`Sabab: ${issue.note}`)}</PreparationText><PreparationText>{t(`${issue.actorName} · ${date}`)}</PreparationText>
    <PreparationText>{t(hasResult ? 'Muammo bo‘yicha rulonlar saqlangan.' : 'Muammo sababi qayd etilgan.')}</PreparationText>
  </ScrollView>;
}
