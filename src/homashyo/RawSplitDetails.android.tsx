import { Host, IconButton, RNHostView, Row, Text as ComposeText, useMaterialColors } from '@expo/ui/jetpack-compose';
import { fillMaxWidth, semantics, weight, width } from '@expo/ui/jetpack-compose/modifiers';
import { SymbolView } from 'expo-symbols';
import { useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';
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

// @v2 RawSplitDetailsSheet
export function RawSplitDetails({ result, printerLabel, showWifiSelector, wifiPrinter, onSelectPrinter, onWifiChanged,
  onReprint, onReprintAll, onError, printBlocked = false }: RawSplitDetailsProps) {
  const colors = useMaterialColors(), [printing, setPrinting] = useState(false), inFlight = useRef(false), mounted = useRef(true), t = usePreparationText();
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const run = async (action: () => Promise<void>) => {
    if (inFlight.current || printBlocked) return;
    inFlight.current = true; setPrinting(true);
    try { await action(); } catch (error) { if (mounted.current) onError(error); } finally { inFlight.current = false; if (mounted.current) setPrinting(false); }
  };
  return <View style={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 20 }}>
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 18 }}>
      <View style={{ width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.secondaryContainer }}>
        <SymbolView name={{ android: 'content_cut' }} size={24} tintColor={colors.onSecondaryContainer} /></View><View style={{ flex: 1, gap: 4 }}>
        <Text style={{ color: colors.onSurface, fontSize: 20, fontWeight: '800' }}>{rawSplitHistoryTitle(result)}</Text><Text style={{ color: colors.onSurfaceVariant, fontSize: 12, lineHeight: 15 }}>{rawSplitHistorySubtitle(result)}</Text></View></View>
    <View style={{ gap: 7, marginBottom: 15 }}>{rawSplitResultDetailRows(result).map(row => <RawSplitDetailLine key={row.label} {...row} />)}</View>
    {result.outputs.map(output => <View key={output.stockId} style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
      <View style={{ flex: 1 }}><Text style={{ color: colors.onSurface, fontSize: 14, fontWeight: '700', marginBottom: 2 }}>{t(rawSplitOutputSummary(output))}</Text><PreparationText>{output.labelName}</PreparationText>
        {output.grossKg !== null && <PreparationText>{t(`Brutto: ${rawSplitDisplay(output.grossKg)} kg · Babina: ${rawSplitDisplay(output.bobinaKg!)} kg`)}</PreparationText>}
        {output.lengthM !== null && !!output.lengthM && <PreparationText>{t(`Metri: ${rawSplitDisplay(output.lengthM)} m`)}</PreparationText>}
        <Text selectable style={{ color: colors.onSurface }}>{output.barcode}</Text></View>
      <Host matchContents><IconButton enabled={!printing && !printBlocked} onClick={() => { void run(() => onReprint(output)); }}
        modifiers={[semantics({ contentDescription: 'Shu rulonni qayta chop etish' })]}><RNHostView matchContents>
          <SymbolView name={{ android: 'print' }} size={22} tintColor={colors.onSurfaceVariant} />
        </RNHostView></IconButton></Host>
    </View>)}
    {printerLabel === null ? <WorkerSheetButton label={t('Printer tanlash')} icon={{ android: 'print' }} disabled={printing || printBlocked} onPress={() => { if (!printBlocked) onSelectPrinter(); }} /> :
      <><View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><SymbolView name={{ android: 'print' }} size={20} tintColor={colors.onSurfaceVariant} />
        <View style={{ flex: 1 }}><Text style={{ color: colors.onSurface, fontSize: 12 }}>{t(`Printer: ${printerLabel}`)}</Text></View>{showWifiSelector && <View style={{ flexShrink: 1 }}>
        <DropdownFilter inline label="" selectedLabel={t(wifiPrinter === 'godex' ? 'GoDEX' : 'Zebra')} backgroundColor={colors.surface}
          enabled={!printing && !printBlocked} options={[{ value: 'godex', label: t('GoDEX') }, { value: 'zebra', label: t('Zebra') }]} onChange={value => { if (!printBlocked) onWifiChanged(value); }} /></View>}</View></>}
    <View style={{ marginTop: 12 }}><WorkerSheetButton label={t('Barchasini qayta chop etish')} icon={{ android: 'print' }} variant="filled" disabled={printing || printBlocked} onPress={() => { void run(onReprintAll); }} /></View>
  </View>;
}

// @v2 RawSplitIssueDetailsSheet
export function RawSplitIssueDetails({ issue, hasResult }: RawSplitIssueDetailsProps) {
  const colors = useMaterialColors(), t = usePreparationText(), date = rawSplitIssueFullTime(issue);
  return <View style={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 20 }}>
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 18 }}>
      <View style={{ width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.secondaryContainer }}>
        <SymbolView name={{ android: 'warning_amber' }} size={24} tintColor={colors.onSecondaryContainer} /></View><View style={{ flex: 1, gap: 4 }}>
        <Text style={{ color: colors.onSurface, fontSize: 20, fontWeight: '800' }}>{issue.source.itemName}</Text><Text style={{ color: colors.onSurfaceVariant, fontSize: 12, lineHeight: 15 }}>{issue.check.message}</Text></View></View>
    <View style={{ gap: 7, marginBottom: 15 }}>{rawSplitIssueDetailRows(issue).map(row => <RawSplitDetailLine key={row.label} {...row} />)}</View>
    <PreparationText>{t(`Sabab: ${issue.note}`)}</PreparationText><Text style={{ color: colors.onSurfaceVariant, fontSize: 12 }}>{t(`${issue.actorName} · ${date}`)}</Text>
    <PreparationText>{t(hasResult ? 'Muammo bo‘yicha rulonlar saqlangan.' : 'Muammo sababi qayd etilgan.')}</PreparationText>
  </View>;
}
