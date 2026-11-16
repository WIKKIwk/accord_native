import { RNHostView, Shape } from '@expo/ui/jetpack-compose';
import { SymbolView } from 'expo-symbols';
import { Text as NativeText } from 'react-native';
import { useBaseTheme } from '../components/useBaseTheme';
import { useAdminFontsReady } from './AdminTypography.android';
import { adminTextStyle } from './adminFontFamily.android';

export const userCreateRounded = (radius: number) => Shape.RoundedCorner({ cornerRadii: { topStart: radius, topEnd: radius, bottomStart: radius, bottomEnd: radius } });
export function UserCreateIcon({ name, color, iconSize = 24 }: { name: 'arrow_back' | 'person_add_alt_1' | 'admin_panel_settings' | 'expand_more' | 'category' | 'content_copy' | 'refresh' | 'search' | 'close'; color: string; iconSize?: number }) {
  return <RNHostView matchContents><SymbolView name={{ android: name }} size={iconSize} tintColor={color} importantForAccessibility="no" /></RNHostView>;
}
/** Compose has no selectable Text API; retain source selection with the native text view. */
export function UserCreateSelectable({ value, fontSize = 16, fontWeight = '500' }: { value: string; fontSize?: number; fontWeight?: '400' | '500' }) {
  const { colors } = useBaseTheme(), ready = useAdminFontsReady();
  return <RNHostView matchContents><NativeText selectable style={{ color: colors.onSurface, fontSize, fontWeight, fontFamily: adminTextStyle({ fontWeight }, ready).fontFamily }}>{value}</NativeText></RNHostView>;
}
