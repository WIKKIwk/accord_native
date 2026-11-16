import { Box, LoadingIndicator, RNHostView, Shape } from '@expo/ui/jetpack-compose';
import { semantics, size } from '@expo/ui/jetpack-compose/modifiers';
import { SymbolView } from 'expo-symbols';
import { useBaseTheme } from '../components/useBaseTheme';

export const workerDetailShape = (radius: number) => Shape.RoundedCorner({ cornerRadii: { topStart: radius, topEnd: radius, bottomStart: radius, bottomEnd: radius } });
export const workerDetailCardShape = () => Shape.RoundedCorner({ cornerRadii: { topStart: 18, topEnd: 18, bottomStart: 6, bottomEnd: 6 } });
export const workerDetailSegmentShape = (index: number, count: number) => Shape.RoundedCorner({ cornerRadii: { topStart: index === 0 ? 18 : 6, topEnd: index === 0 ? 18 : 6,
  bottomStart: index > 0 && index === count - 1 ? 18 : 6, bottomEnd: index > 0 && index === count - 1 ? 18 : 6 } });
export const workerDetailAlpha = (color: string, alpha: number) => /^#[0-9a-f]{6}(?:[0-9a-f]{2})?$/i.test(color) ? `${color.slice(0, 7)}${Math.round(alpha * 255).toString(16).padStart(2, '0')}` : color;
export function WorkerDetailLoading() {
  const { colors } = useBaseTheme();
  return <Box contentAlignment="center" modifiers={[size(64, 64)]}><LoadingIndicator color={colors.primary} modifiers={[size(48, 48), semantics({ contentDescription: 'Loading' })]} /></Box>;
}
export type WorkerDetailIconName = 'arrow_back' | 'phone' | 'badge' | 'warehouse' | 'expand_more' | 'expand_less' | 'check' | 'edit' | 'content_copy' | 'refresh' | 'add' | 'close' | 'inventory_2' | 'search' | 'radio_button_unchecked' | 'check_circle';
export function WorkerDetailIcon({ name, color, iconSize = 24 }: { name: WorkerDetailIconName; color: string; iconSize?: number }) {
  return <RNHostView matchContents><SymbolView name={{ android: name }} size={iconSize} tintColor={color} importantForAccessibility="no" /></RNHostView>;
}
