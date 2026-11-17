import { Button, Column, OutlinedButton, Spacer, Switch, Row, useNativeState } from '@expo/ui/jetpack-compose';
import { defaultMinSize, fillMaxWidth, height, padding, weight } from '@expo/ui/jetpack-compose/modifiers';
import { useEffect } from 'react';
import { BaseHost } from '../components/BaseHost.android';
import { AdminOutlinedTextField } from '../admin/AdminTextFields.android';
import { AdminText as Text } from '../admin/AdminTypography.android';
import { userCreateRounded } from '../admin/AdminUserCreateNative.android';
import { useBaseTheme } from '../components/useBaseTheme';
import type { ReactNode } from 'react';

export function Form({ children }: { children: ReactNode }) { return <BaseHost matchContents={{ vertical: true }} style={{ width: '100%' }}><Column modifiers={[fillMaxWidth(), padding(12, 12, 12, 24)]}>{children}</Column></BaseHost>; }
export function Field({ label, value, onChange, numeric, multiline, disabled, error }: { label: string; value: string; onChange: (value: string) => void; numeric?: boolean; multiline?: boolean; disabled?: boolean; error?: string }) {
  const state = useNativeState(value), { colors, mode } = useBaseTheme();
  useEffect(() => { state.set(value); }, [state, value]);
  return <Column modifiers={[fillMaxWidth(), padding(0, 0, 0, 12)]}><AdminOutlinedTextField value={state} onValueChange={onChange} singleLine={!multiline} enabled={!disabled} isError={!!error} shape={userCreateRounded(18)}
    keyboardOptions={{ keyboardType: numeric ? 'decimal' : 'text' }} colors={{ focusedContainerColor: mode === 'light' ? colors.surfaceBright : colors.surfaceContainerHighest, unfocusedContainerColor: mode === 'light' ? colors.surfaceBright : colors.surfaceContainerHighest }} modifiers={[fillMaxWidth()]}>
    <AdminOutlinedTextField.Label><Text>{label}</Text></AdminOutlinedTextField.Label>{error ? <AdminOutlinedTextField.SupportingText><Text color={colors.error}>{error}</Text></AdminOutlinedTextField.SupportingText> : null}
  </AdminOutlinedTextField></Column>;
}
export function Action({ label, onPress, disabled, secondary }: { label: string; onPress: () => void; disabled?: boolean; secondary?: boolean }) {
  const Component = secondary ? OutlinedButton : Button;
  return <Column modifiers={[fillMaxWidth(), padding(0, 6, 0, 6)]}><Component enabled={!disabled} onClick={onPress} shape={userCreateRounded(20)} modifiers={[fillMaxWidth(), defaultMinSize({ minHeight: 56 })]}><Text>{label}</Text></Component></Column>;
}
export function Toggle({ label, value, onChange, disabled }: { label: string; value: boolean; onChange: (value: boolean) => void; disabled?: boolean }) { return <Row verticalAlignment="center" modifiers={[fillMaxWidth(), padding(0, 8, 0, 8)]}><Text modifiers={[weight(1)]}>{label}</Text><Switch value={value} onCheckedChange={onChange} enabled={!disabled} /></Row>; }
export function Label({ children }: { children: string }) { return <Text style={{ typography: 'bodyMedium' }}>{children}</Text>; }
export function Gap({ size = 12 }: { size?: number }) { return <Spacer modifiers={[height(size)]} />; }
