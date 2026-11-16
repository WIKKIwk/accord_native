import { RNHostView, Shape, type OutlinedTextFieldProps } from '@expo/ui/jetpack-compose';
import { SymbolView } from 'expo-symbols';
import { useBaseTheme } from '../components/useBaseTheme';
import { AdminOutlinedTextField } from './AdminTextFields.android';

export const decisionRounded = (radius: number) => Shape.RoundedCorner({ cornerRadii: { topStart: radius, topEnd: radius, bottomStart: radius, bottomEnd: radius } });
export function DecisionIcon({ name, color, size = 24 }: { name: 'search' | 'arrow_forward' | 'business' | 'radio_button_checked' | 'radio_button_unchecked' | 'delete_forever'; color: string; size?: number }) {
  return <RNHostView matchContents><SymbolView name={{ android: name }} size={size} tintColor={color} importantForAccessibility="no" /></RNHostView>;
}
function Field(props: OutlinedTextFieldProps) {
  const { colors, mode } = useBaseTheme(), fill = mode === 'dark' ? colors.surfaceContainerHigh : colors.surfaceContainerHighest;
  // Source InputDecorationTheme fill/ink/label/border colors; the native input owns its buffer.
  // Expo's OutlinedTextField has no contentPadding or focused-border-width API (Source 18/16 and 1.6 remain physical parity gaps).
  return <AdminOutlinedTextField {...props} colors={{ focusedContainerColor: fill, unfocusedContainerColor: fill, focusedTextColor: colors.onSurface, unfocusedTextColor: colors.onSurface,
    focusedIndicatorColor: colors.primary, unfocusedIndicatorColor: colors.outlineVariant, focusedLabelColor: colors.onSurfaceVariant, unfocusedLabelColor: colors.onSurfaceVariant, ...props.colors }} />;
}
export const DecisionField = Object.assign(Field, { Label: AdminOutlinedTextField.Label, LeadingIcon: AdminOutlinedTextField.LeadingIcon, TrailingIcon: AdminOutlinedTextField.TrailingIcon });
