import { Button, Column, FlowRow, IconButton, RNHostView, Row, Text, useMaterialColors } from '@expo/ui/jetpack-compose';
import { fillMaxWidth, semantics, testID, weight, width } from '@expo/ui/jetpack-compose/modifiers';
import { SymbolView } from 'expo-symbols';
import { werkaArchivePeriodGridPresentation, type WerkaArchivePeriodGridProps } from './werkaArchivePeriodPresentation';

/** Inline native grid, inside the owner's Compose Host. No load, shell or route is bound. */
export function WerkaArchivePeriodGrid(props: WerkaArchivePeriodGridProps) {
  const colors = useMaterialColors(), model = werkaArchivePeriodGridPresentation(props);
  const cellButton = (cell: (typeof model.cells)[number]) => <Button key={cell.id} onClick={() => props.onSelect(cell.query)}
    colors={{ containerColor: cell.active ? colors.primaryContainer : colors.surfaceContainerHighest,
      contentColor: cell.active ? colors.onPrimaryContainer : colors.onSurfaceVariant }}
    modifiers={[props.page.period === 'monthly' ? width(model.monthWidth) : weight(1), testID(cell.id)]}>
    <Text style={{ typography: 'titleMedium', fontWeight: cell.active ? 'bold' : '500' }}>{cell.label}</Text>
  </Button>;
  return <Column verticalArrangement={{ spacedBy: 12 }}>
    <Row modifiers={[fillMaxWidth()]} verticalAlignment="center">
      <IconButton onClick={() => props.onPageStep(-1)} modifiers={[semantics({ contentDescription: model.previousLabel }), testID(model.previousId)]}>
        <RNHostView matchContents><SymbolView name={{ android: 'chevron_left' }} size={24} tintColor={colors.onSurfaceVariant} /></RNHostView>
      </IconButton><Text modifiers={[weight(1)]} style={{ typography: 'titleLarge', textAlign: 'center' }}>{model.pageLabel}</Text>
      <IconButton onClick={() => props.onPageStep(1)} modifiers={[semantics({ contentDescription: model.nextLabel }), testID(model.nextId)]}>
        <RNHostView matchContents><SymbolView name={{ android: 'chevron_right' }} size={24} tintColor={colors.onSurfaceVariant} /></RNHostView>
      </IconButton>
    </Row>
    {props.page.period === 'monthly'
      ? <FlowRow horizontalArrangement={{ spacedBy: model.monthSpacing }} verticalArrangement={{ spacedBy: 10 }}>{model.cells.map(cellButton)}</FlowRow>
      : model.rows.map((row, index) => <Row key={index} horizontalArrangement={{ spacedBy: 10 }} modifiers={[fillMaxWidth()]}>{row.map(cellButton)}</Row>)}
    {model.emptyLabel !== null ? <Text color={colors.onSurfaceVariant}>{model.emptyLabel}</Text> : null}
  </Column>;
}
