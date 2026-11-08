import { Host, IconButton, RNHostView, useMaterialColors } from '@expo/ui/jetpack-compose';
import { semantics } from '@expo/ui/jetpack-compose/modifiers';
import { SymbolView } from 'expo-symbols';
import { useEffect, useRef, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { WorkerSheetButton } from '../components/WorkerSheetButton';
import { PreparationText, usePreparationText } from '../preparation/PreparationUI.android';
import { DropdownFilter } from '../shared/filters/DropdownFilter.android';
import { rawSplitDisplay } from './rawSplitModel';
import { rawSplitHistorySubtitle, rawSplitHistoryTitle, rawSplitIssueFullTime, rawSplitIssueOutputSummary, rawSplitOutputSummary } from './rawSplitHistoryPresentation';
import type { RawSplitDetailsProps, RawSplitIssueDetailsProps } from './rawSplitDetailsTypes';

export function RawSplitDetails({ result, printerLabel, showWifiSelector, wifiPrinter, onSelectPrinter, onWifiChanged,
  onReprint, onReprintAll, onError }: RawSplitDetailsProps) {
  const colors = useMaterialColors(), [printing, setPrinting] = useState(false), inFlight = useRef(false), mounted = useRef(true), t = usePreparationText();
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const run = async (action: () => Promise<void>) => {
    if (inFlight.current) return;
    inFlight.current = true; setPrinting(true);
    try { await action(); } catch (error) { onError(error); } finally { inFlight.current = false; if (mounted.current) setPrinting(false); }
  };
  return <ScrollView contentContainerStyle={{ padding: 20, gap: 8, paddingBottom: 32 }}>
    <PreparationText title>{rawSplitHistoryTitle(result)}</PreparationText><PreparationText>{rawSplitHistorySubtitle(result)}</PreparationText>
    <PreparationText>{`Manba QR: ${result.source.barcode}`}</PreparationText><PreparationText>{`Ombor: ${result.source.warehouse}`}</PreparationText>
    {result.createdAt !== null && <PreparationText>{`Vaqti: ${result.createdAt}`}</PreparationText>}
    {result.issueId !== null && <><PreparationText>{`Farq: ${result.differenceLabel}`}</PreparationText><PreparationText>{`Sabab: ${result.issueNote ?? ''}`}</PreparationText></>}
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
      <><PreparationText>{t(`Printer: ${printerLabel}`)}</PreparationText>{showWifiSelector &&
        <DropdownFilter label="" selectedLabel={t(wifiPrinter === 'godex' ? 'GoDEX' : 'Zebra')} backgroundColor={colors.surface}
          enabled={!printing} options={[{ value: 'godex', label: t('GoDEX') }, { value: 'zebra', label: t('Zebra') }]} onChange={onWifiChanged} />}</>}
    <WorkerSheetButton label={t('Barchasini qayta chop etish')} variant="filled" disabled={printing} onPress={() => { void run(onReprintAll); }} />
  </ScrollView>;
}

export function RawSplitIssueDetails({ issue, hasResult }: RawSplitIssueDetailsProps) {
  const t = usePreparationText(), date = rawSplitIssueFullTime(issue);
  return <ScrollView contentContainerStyle={{ padding: 20, gap: 8, paddingBottom: 32 }}>
    <PreparationText title>{issue.source.itemName}</PreparationText><PreparationText>{issue.check.message}</PreparationText>
    <PreparationText>{`QR: ${issue.source.barcode}`}</PreparationText>
    <PreparationText>{`Asl: ${rawSplitDisplay(issue.source.kg)} kg · Atxot: ${issue.enteredWaste || 'kiritilmagan'} kg`}</PreparationText>
    {issue.outputs.map((output, index) => <PreparationText key={index}>{`${index + 1}-rulon: ${rawSplitIssueOutputSummary(output)}`}</PreparationText>)}
    <PreparationText>{t(`Sabab: ${issue.note}`)}</PreparationText><PreparationText>{t(`${issue.actorName} · ${date}`)}</PreparationText>
    <PreparationText>{t(hasResult ? 'Muammo bo‘yicha rulonlar saqlangan.' : 'Muammo sababi qayd etilgan.')}</PreparationText>
  </ScrollView>;
}
