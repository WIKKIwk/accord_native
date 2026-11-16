import { Column, RNHostView, Row, Shape, Spacer, TextButton } from '@expo/ui/jetpack-compose';
import { defaultMinSize, fillMaxWidth, height, padding, size, testID, weight } from '@expo/ui/jetpack-compose/modifiers';
import { SymbolView } from 'expo-symbols';
import { ScrollView, StyleSheet } from 'react-native';
import { BaseHost } from '../components/BaseHost.android';
import { useBaseTheme } from '../components/useBaseTheme';
import { AdminText as Text } from './AdminTypography.android';
import type { AdminItemDetailActionMenuContentProps } from './AdminItemDetailActionMenuContentTypes';
import { useAdminItemDetailActionMenuContent } from './useAdminItemDetailActionMenuContent';

const icons = { rename: 'edit', customers: 'people_outline', group: 'account_tree', delete: 'delete_outline' } as const;
/** @v2 _ItemDetailActionsSheet; the real parent supplies bottom-sheet kind, drag handle, SafeArea and native completion. */
export function AdminItemDetailActionMenuContent(props: AdminItemDetailActionMenuContentProps) {
  const model = useAdminItemDetailActionMenuContent(props), { colors, mode } = useBaseTheme(); if (!model.visible) return null;
  const disabledColor = mode === 'dark' ? '#FFFFFF61' : '#00000061';
  return <ScrollView style={styles.scroll}><BaseHost matchContents={{ vertical: true }} style={styles.width}><Column modifiers={[fillMaxWidth(), padding(20, 0, 20, 16)]}>
    <Text style={{ typography: 'titleLarge', fontWeight: '700' }}>{model.title}</Text>
    {model.message !== null ? <><Spacer modifiers={[height(8)]} /><Text color={colors.onSurfaceVariant} style={{ typography: 'bodyMedium' }}>{model.message}</Text></> : null}
    <Spacer modifiers={[height(12)]} />
    {model.rows.map(row => <TextButton key={row.key} enabled={row.enabled && !model.closing} onClick={() => model.choose(row.action)}
      shape={Shape.RoundedCorner({ cornerRadii: { topStart: 0, topEnd: 0, bottomStart: 0, bottomEnd: 0 } })}
      contentPadding={{ start: 16, end: 24, top: 8, bottom: 8 }} colors={{ contentColor: colors.onSurface, disabledContentColor: row.enabled ? colors.onSurface : disabledColor }}
      modifiers={[fillMaxWidth(), defaultMinSize({ minWidth: 0, minHeight: 56 }), testID(row.key)]}>
      <Row verticalAlignment="center" modifiers={[fillMaxWidth()]}><RNHostView matchContents><SymbolView name={{ android: icons[row.action] }} size={24}
        tintColor={row.enabled ? colors.onSurfaceVariant : disabledColor} importantForAccessibility="no" /></RNHostView><Spacer modifiers={[size(16, 1)]} />
        <Text color={row.enabled ? colors.onSurface : disabledColor} style={{ typography: 'bodyLarge', fontWeight: '400' }} modifiers={[weight(1)]}>{row.label}</Text>
      </Row>
    </TextButton>)}
  </Column></BaseHost></ScrollView>;
}
const styles = StyleSheet.create({ width: { width: '100%' }, scroll: { width: '100%', flexGrow: 0 } });
