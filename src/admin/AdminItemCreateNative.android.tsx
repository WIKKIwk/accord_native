import { RNHostView, Shape } from '@expo/ui/jetpack-compose';
import { SymbolView } from 'expo-symbols';
export const itemCreateRounded = (radius: number) => Shape.RoundedCorner({ cornerRadii: { topStart: radius, topEnd: radius, bottomStart: radius, bottomEnd: radius } });
export function ItemCreateIcon({ name, color, size = 24 }: { name: 'inventory_2' | 'arrow_back' | 'check' | 'close' | 'expand_more' | 'expand_less' | 'chevron_right' | 'refresh' | 'drive_file_move' | 'add' | 'search'; color: string; size?: number }) {
  return <RNHostView matchContents><SymbolView name={{ android: name }} size={size} tintColor={color} importantForAccessibility="no" /></RNHostView>;
}
