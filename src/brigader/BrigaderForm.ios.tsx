import { Button, Text, TextField, Toggle as NativeToggle, VStack, useNativeState } from '@expo/ui/swift-ui';
import { buttonStyle, controlSize, disabled as inactive, foregroundStyle, frame, keyboardType, padding, textFieldStyle } from '@expo/ui/swift-ui/modifiers';
import { useEffect, type ReactNode } from 'react';
import { BaseHost } from '../components/BaseHost.ios';

export function Form({ children }: { children: ReactNode }) { return <BaseHost matchContents={{ vertical: true }} style={{ width: '100%' }}><VStack alignment="leading" spacing={12} modifiers={[frame({ maxWidth: Infinity }), padding({ horizontal: 12, top: 12, bottom: 24 })]}>{children}</VStack></BaseHost>; }
export function Field({ label, value, onChange, numeric, multiline, disabled, error }: { label: string; value: string; onChange: (value: string) => void; numeric?: boolean; multiline?: boolean; disabled?: boolean; error?: string }) {
  const state = useNativeState(value); useEffect(() => { state.set(value); }, [state, value]);
  return <VStack alignment="leading" spacing={6} modifiers={[frame({ maxWidth: Infinity, alignment: 'leading' })]}><Text>{label}</Text><TextField text={state} onTextChange={onChange} axis={multiline ? 'vertical' : 'horizontal'} modifiers={[textFieldStyle('roundedBorder'), keyboardType(numeric ? 'decimal-pad' : 'default'), inactive(!!disabled), frame({ maxWidth: Infinity })]} />{error ? <Text modifiers={[foregroundStyle('red')]}>{error}</Text> : null}</VStack>;
}
export function Action({ label, onPress, disabled, secondary }: { label: string; onPress: () => void; disabled?: boolean; secondary?: boolean }) { return <Button label={label} onPress={onPress} modifiers={[buttonStyle(secondary ? 'bordered' : 'borderedProminent'), controlSize('large'), inactive(!!disabled), frame({ maxWidth: Infinity, minHeight: 56 })]} />; }
export function Toggle({ label, value, onChange, disabled }: { label: string; value: boolean; onChange: (value: boolean) => void; disabled?: boolean }) { return <NativeToggle label={label} isOn={value} onIsOnChange={onChange} modifiers={[inactive(!!disabled)]} />; }
export function Label({ children }: { children: string }) { return <Text>{children}</Text>; }
export function Gap({ size = 12 }: { size?: number }) { return <VStack modifiers={[frame({ height: size })]}>{null}</VStack>; }
