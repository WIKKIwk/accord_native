import { Button, Column, FlowRow, Host, IconButton, RNHostView, Row, Text, useMaterialColors } from '@expo/ui/jetpack-compose';
import { fillMaxWidth, semantics, testID, weight, width } from '@expo/ui/jetpack-compose/modifiers';
import { SymbolView } from 'expo-symbols';
import { View } from 'react-native';
import { useSharedValue } from 'react-native-reanimated';
import { PreparationRow, PreparationText } from '../preparation/PreparationUI.android';
import { localizedGetter } from '../shared/localization';
import { OrdersList } from '../shared/orders/OrdersList';
import { werkaArchivePeriodBody, werkaArchivePeriodPresentation, type WerkaArchivePeriodContentProps } from './werkaArchivePeriodPresentation';

/** Controlled month/year content only. The owner supplies safe loads, locale labels, shell and navigation. */
export function WerkaArchivePeriodContent(props: WerkaArchivePeriodContentProps) {
  const colors = useMaterialColors(), headerOffset = useSharedValue(0), headerHeight = useSharedValue(0);
  const body = werkaArchivePeriodBody(props.loading, props.error, props.active);
  if (body === 'loading') return <View style={{ flex: 1 }} />;
  if (body === 'error') return <View><PreparationText>{localizedGetter('serverDisconnectedRetry', props.locale)}</PreparationText>
    <PreparationRow title={localizedGetter('retry', props.locale)} onPress={() => { void props.onRefresh(); }} /></View>;
  const model = werkaArchivePeriodPresentation(props.kind, props.page, props.active, props.locale, props.formatMonthYear);
  const cellButton = (cell: (typeof model.cells)[number]) => <Button key={cell.id} onClick={() => props.onSelect(cell.query)}
    colors={{ containerColor: cell.active ? colors.primaryContainer : colors.surfaceContainerHighest,
      contentColor: cell.active ? colors.onPrimaryContainer : colors.onSurfaceVariant }}
    modifiers={[props.page.period === 'monthly' ? width(100) : weight(1), testID(cell.id)]}>
    <Text style={{ typography: 'titleMedium', fontWeight: cell.active ? 'bold' : '500' }}>{cell.label}</Text>
  </Button>;
  return <OrdersList active onRefresh={props.onRefresh} headerOffset={headerOffset} headerHeight={headerHeight} topInset={4} passthrough={() => true}>
    <Host matchContents={{ vertical: true }} style={{ width: '100%', paddingHorizontal: 18 }}><Column verticalArrangement={{ spacedBy: 12 }}>
      <Row modifiers={[fillMaxWidth()]} verticalAlignment="center">
        <IconButton onClick={() => props.onPageStep(-1)} modifiers={[semantics({ contentDescription: model.previousLabel }), testID('archive_previous_page')]}>
          <RNHostView matchContents><SymbolView name={{ android: 'chevron_left' }} size={24} tintColor={colors.onSurfaceVariant} /></RNHostView>
        </IconButton><Text modifiers={[weight(1)]} style={{ typography: 'titleLarge', textAlign: 'center' }}>{model.pageLabel}</Text>
        <IconButton onClick={() => props.onPageStep(1)} modifiers={[semantics({ contentDescription: model.nextLabel }), testID('archive_next_page')]}>
          <RNHostView matchContents><SymbolView name={{ android: 'chevron_right' }} size={24} tintColor={colors.onSurfaceVariant} /></RNHostView>
        </IconButton>
      </Row>
      {props.page.period === 'monthly'
        ? <FlowRow horizontalArrangement={{ spacedBy: 10 }} verticalArrangement={{ spacedBy: 10 }}>{model.cells.map(cellButton)}</FlowRow>
        : model.rows.map((row, index) => <Row key={index} horizontalArrangement={{ spacedBy: 10 }} modifiers={[fillMaxWidth()]}>{row.map(cellButton)}</Row>)}
      {model.emptyLabel !== null ? <Text color={colors.onSurfaceVariant}>{model.emptyLabel}</Text> : null}
    </Column></Host><View style={{ height: 136 }} />
  </OrdersList>;
}
