import { Box, Column, FilledTonalButton, HorizontalDivider, Host, RNHostView, Row, Shape, Spacer, Surface, Text, useMaterialColors } from '@expo/ui/jetpack-compose';
import { alpha, background, clip, defaultMinSize, fillMaxWidth, padding, Shapes, size, testID, weight, width } from '@expo/ui/jetpack-compose/modifiers';
import { SymbolView } from 'expo-symbols';
import { View } from 'react-native';
import { useCustomerText } from './CustomerContext';
import { customerLayoutDirection, customerStatusRows, type CustomerStatusPanelProps } from './customerPresentation';

export function CustomerStatusPanel({ summary, onOpenStatus }: CustomerStatusPanelProps) {
  const colors = useMaterialColors(), { locale, text } = useCustomerText(), direction = customerLayoutDirection(locale);
  const rows = customerStatusRows(summary);
  return <View style={{ marginHorizontal: 8 }}><Host matchContents={{ vertical: true }} layoutDirection={direction} style={{ width: '100%' }}>
    <Surface color={colors.surfaceContainerLow} contentColor={colors.onSurface}
      shape={Shape.RoundedCorner({ cornerRadii: { topStart: 28, topEnd: 28, bottomStart: 28, bottomEnd: 28 } })}>
      <Column modifiers={[fillMaxWidth()]}>{rows.map((row, index) => {
        const highlighted = row.kind === 'pending', open = () => onOpenStatus(row.kind);
        return <Column key={row.kind}>
          <Surface color={highlighted ? colors.surfaceContainer : colors.surfaceContainerLow} contentColor={colors.onSurface} onClick={open}
            shape={Shape.RoundedCorner({ cornerRadii: { topStart: index === 0 ? 28 : 0, topEnd: index === 0 ? 28 : 0,
              bottomStart: index === rows.length - 1 ? 28 : 0, bottomEnd: index === rows.length - 1 ? 28 : 0 } })}
            modifiers={[fillMaxWidth(), testID(`customer-status-row-${row.kind}`)]}>
            <Row verticalAlignment="center" modifiers={[fillMaxWidth(), padding(20, 20, 20, 20)]}>
              <Row verticalAlignment="center" horizontalArrangement={{ spacedBy: 12 }} modifiers={[weight(1)]}>
                {highlighted ? <Box modifiers={[size(4, 24), clip(Shapes.RoundedCorner(999)), background(colors.primary)]} /> : null}
                <Text style={{ typography: 'titleMedium' }}>{text(row.titleKey)}</Text>
              </Row>
              <FilledTonalButton onClick={open} colors={{ containerColor: colors.primary, contentColor: colors.onPrimary }}
                contentPadding={{ start: 14, end: 14, top: 0, bottom: 0 }}
                shape={Shape.RoundedCorner({ cornerRadii: { topStart: 14, topEnd: 14, bottomStart: 14, bottomEnd: 14 } })}
                modifiers={[defaultMinSize({ minWidth: 44, minHeight: 40 }), testID(`customer-status-count-${row.kind}`)]}>
                <Text style={{ typography: 'labelLarge', fontSize: 16, fontWeight: '500' }}>{String(row.count)}</Text>
              </FilledTonalButton>
              <Spacer modifiers={[width(6)]} />
              <RNHostView matchContents><SymbolView name={{ android: direction === 'rightToLeft' ? 'chevron_left' : 'chevron_right' }}
                size={22} tintColor={colors.onSurfaceVariant} accessible={false} importantForAccessibility="no-hide-descendants" /></RNHostView>
            </Row>
          </Surface>
          {index < rows.length - 1 ? <HorizontalDivider thickness={1} color={colors.outlineVariant}
            modifiers={[padding(18, 0, 18, 0), alpha(0.55)]} /> : null}
        </Column>;
      })}</Column>
    </Surface>
  </Host></View>;
}
