import { Box, Button, Column, Host, IconButton, OutlinedButton, RNHostView, Row, Text, TextButton, useMaterialColors } from '@expo/ui/jetpack-compose';
import { background, clip, defaultMinSize, fillMaxWidth, padding, semantics, Shapes, size, testID, weight } from '@expo/ui/jetpack-compose/modifiers';
import { SymbolView } from 'expo-symbols';
import { usePreparationText } from './PreparationUI.android';

export function InventorySheetSummary({ title, code, status, onShowQr }: {
  title: string; code: string; status: string; onShowQr?: () => void;
}) {
  const colors = useMaterialColors(), t = usePreparationText();
  return <Host matchContents={{ vertical: true }} style={{ width: '100%' }}>
    <Row verticalAlignment="top" horizontalArrangement={{ spacedBy: 4 }} modifiers={[fillMaxWidth()]}>
      <Column verticalArrangement={{ spacedBy: 2 }} modifiers={[weight(1)]}>
        <Text color={colors.onSurface} style={{ typography: 'titleLarge', fontSize: 20 }}>{title}</Text>
        {code.trim() && code.trim() !== title.trim() ? <Text color={colors.onSurfaceVariant} style={{ typography: 'bodySmall' }}>{code}</Text> : null}
      </Column>
      <Box modifiers={[clip(Shapes.RoundedCorner(16)), background(colors.secondaryContainer), padding(10, 4, 10, 4)]}>
        <Text color={colors.onSecondaryContainer} style={{ typography: 'labelMedium' }}>{status}</Text>
      </Box>
      {onShowQr ? <IconButton onClick={onShowQr} modifiers={[size(40, 40), semantics({ contentDescription: t('QR kodni ko‘rish') }), testID('preparation-inventory-qr-open')]}>
        <RNHostView matchContents><SymbolView name={{ android: 'qr_code_2' }} size={24} tintColor={colors.onSurfaceVariant} /></RNHostView>
      </IconButton> : null}
    </Row>
  </Host>;
}

export function InventoryDetailRow({ label, value, stacked = false }: { label: string; value: string; stacked?: boolean }) {
  const colors = useMaterialColors(), t = usePreparationText();
  return <Host matchContents={{ vertical: true }} style={{ width: '100%' }}>
    {stacked ? <Column verticalArrangement={{ spacedBy: 4 }} modifiers={[fillMaxWidth()]}>
      <Text color={colors.onSurfaceVariant} style={{ typography: 'labelMedium' }}>{t(label)}</Text>
      <Text color={colors.onSurface} style={{ typography: 'bodySmall', fontFamily: 'monospace' }}>{value || '—'}</Text>
    </Column> : <Row verticalAlignment="top" horizontalArrangement={{ spacedBy: 16 }} modifiers={[fillMaxWidth(), padding(0, 4, 0, 4)]}>
      <Text color={colors.onSurfaceVariant} style={{ typography: 'bodyMedium' }} modifiers={[weight(1)]}>{t(label)}</Text>
      <Text color={colors.onSurface} style={{ typography: 'bodyMedium' }} modifiers={[weight(2)]}>{value || '—'}</Text>
    </Row>}
  </Host>;
}

export function InventorySheetNote({ children }: { children: string }) {
  const colors = useMaterialColors();
  return <Host matchContents={{ vertical: true }} style={{ width: '100%' }}>
    <Text color={colors.onSurfaceVariant} style={{ typography: 'bodySmall' }}>{children}</Text>
  </Host>;
}

export function InventorySheetButton({ label, onPress, disabled, kind = 'primary', id, large = false }: {
  label: string; onPress: () => void; disabled?: boolean; kind?: 'primary' | 'outlined' | 'text'; id?: string; large?: boolean;
}) {
  const t = usePreparationText();
  const Component = kind === 'outlined' ? OutlinedButton : kind === 'text' ? TextButton : Button;
  return <Host matchContents={{ vertical: true }} style={{ width: '100%' }}>
    <Component enabled={!disabled} onClick={onPress}
      modifiers={[fillMaxWidth(), defaultMinSize({ minHeight: large ? 64 : 48 }), ...(id ? [testID(id)] : [])]}>
      <Text style={large ? { typography: 'titleMedium', fontSize: 18 } : undefined}>{t(label)}</Text>
    </Component>
  </Host>;
}
