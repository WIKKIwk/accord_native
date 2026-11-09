import { FlowRow, RNHostView, Row, Shape, Surface, Text, useMaterialColors } from '@expo/ui/jetpack-compose';
import { defaultMinSize, padding } from '@expo/ui/jetpack-compose/modifiers';
import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import type { AdminWorkMapAuditPresentation } from './adminWorkMapAuditPresentation';

const icons: Record<string, SymbolViewProps['name']> = {
  orders: { android: 'receipt_long' }, batches: { android: 'inventory_2' }, sessions: { android: 'play_circle_outline' }, errors: { android: 'report_problem' },
};

/** Compose surfaces are deliberately non-interactive, like the source Chip. */
export function AdminWorkMapAuditCounts({ counts }: { counts: AdminWorkMapAuditPresentation['counts'] }) {
  const colors = useMaterialColors();
  return <FlowRow horizontalArrangement={{ spacedBy: 8 }} verticalArrangement={{ spacedBy: 8 }}>
    {counts.map(count => <Surface key={count.id} color={colors.surfaceContainerLow} border={{ width: 1, color: colors.outlineVariant }}
      shape={Shape.RoundedCorner({ cornerRadii: { topStart: 8, topEnd: 8, bottomStart: 8, bottomEnd: 8 } })}>
      <Row horizontalArrangement={{ spacedBy: 8 }} verticalAlignment="center" modifiers={[defaultMinSize({ minHeight: 32 }), padding(8, 4, 8, 4)]}>
        <RNHostView matchContents><SymbolView name={icons[count.id]} size={17} tintColor={colors.onSurfaceVariant} importantForAccessibility="no" /></RNHostView>
        <Text style={{ typography: 'labelLarge' }} color={colors.onSurfaceVariant}>{count.text}</Text>
      </Row>
    </Surface>)}
  </FlowRow>;
}
