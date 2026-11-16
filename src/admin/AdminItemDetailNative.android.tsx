import { CircularProgressIndicator, Column, RNHostView, Row, Shape, Spacer, Surface } from '@expo/ui/jetpack-compose';
import { fillMaxWidth, height, padding, size, testID as nativeTestID, weight } from '@expo/ui/jetpack-compose/modifiers';
import { SymbolView } from 'expo-symbols';
import type { ReactNode } from 'react';
import { BaseHost } from '../components/BaseHost.android';
import { useBaseTheme } from '../components/useBaseTheme';
import { AdminText as Text } from './AdminTypography.android';
import type { AdminItemDetailInformationRow } from './AdminItemDetailReadPresentation';

export const itemDetailRounded = (radius: number) => Shape.RoundedCorner({ cornerRadii: { topStart: radius, topEnd: radius, bottomStart: radius, bottomEnd: radius } });
export const itemDetailDisabled = (color: string) => /^#[\da-f]{6}/i.test(color) ? `${color.slice(0, 7)}61` : color;
export function ItemDetailIcon({ name, color, iconSize = 24 }: { name: 'inventory_2' | 'edit' | 'account_tree' | 'delete_forever' | 'more_horiz' | 'refresh' | 'arrow_back'; color: string; iconSize?: number }) {
  return <RNHostView matchContents><SymbolView name={{ android: name }} tintColor={color} size={iconSize} importantForAccessibility="no" /></RNHostView>;
}
export function ItemDetailSpinner() { return <CircularProgressIndicator strokeWidth={2} modifiers={[size(18, 18)]} />; }
export function ItemDetailSection({ title, children, testID }: { title: string; children: ReactNode; testID?: string }) {
  const { colors } = useBaseTheme();
  return <BaseHost matchContents={{ vertical: true }} style={{ width: '100%' }}><Surface color={colors.surface} shape={itemDetailRounded(20)} modifiers={testID ? [nativeTestID(testID)] : undefined}>
    <Column modifiers={[fillMaxWidth(), padding(16, 16, 16, 6)]}><Text style={{ typography: 'titleMedium', fontWeight: '800' }}>{title}</Text><Spacer modifiers={[height(8)]} />{children}</Column>
  </Surface></BaseHost>;
}
export function ItemDetailRow({ row }: { row: AdminItemDetailInformationRow }) {
  const { colors } = useBaseTheme();
  return <Row verticalAlignment="top" modifiers={[fillMaxWidth(), padding(0, 10, 0, 10)]}>
    <Text color={colors.onSurfaceVariant} style={{ typography: 'bodyMedium' }} modifiers={[weight(4)]}>{row.label}</Text><Spacer modifiers={[size(14, 1)]} />
    <Text style={{ typography: 'bodyLarge', fontWeight: '600', textAlign: 'end' }} modifiers={[weight(6)]}>{row.value}</Text>
  </Row>;
}
