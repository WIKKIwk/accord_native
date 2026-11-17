import { Button, HStack, Picker, ProgressView, RNHostView, Text, TextField, Toggle as NativeToggle, VStack, useNativeState } from '@expo/ui/swift-ui';
import { buttonStyle, controlSize, disabled as inactive, foregroundStyle, frame, keyboardType, padding, pickerStyle, tag, textFieldStyle } from '@expo/ui/swift-ui/modifiers';
import { useEffect, type ReactNode,type ReactElement } from 'react';
import { BaseHost } from '../components/BaseHost.ios';

export function Form({ children }: { children: ReactNode }) { return <BaseHost matchContents={{ vertical: true }} style={{ width: '100%' }}><VStack alignment="leading" spacing={12} modifiers={[frame({ maxWidth: Infinity }), padding({ horizontal: 12, top: 12, bottom: 24 })]}>{children}</VStack></BaseHost>; }
export function Field({ label, value, onChange, numeric, multiline, disabled, error,unit,hint }: { label: string; value: string; onChange: (value: string) => void; numeric?: boolean; multiline?: boolean; disabled?: boolean; error?: string;unit?:string;hint?:string }) {
  const state = useNativeState(value); useEffect(() => { state.set(value); }, [state, value]);
  return <VStack alignment="leading" spacing={6} modifiers={[frame({ maxWidth: Infinity, alignment: 'leading' })]}><Text>{label}</Text><TextField placeholder={hint} text={state} onTextChange={onChange} axis={multiline ? 'vertical' : 'horizontal'} modifiers={[textFieldStyle('roundedBorder'), keyboardType(numeric ? 'decimal-pad' : 'default'), inactive(!!disabled), frame({ maxWidth: Infinity })]} />{unit ? <Text modifiers={[foregroundStyle('secondary')]}>{unit}</Text> : null}{error ? <Text modifiers={[foregroundStyle('red')]}>{error}</Text> : null}</VStack>;
}
export function Action({ label, onPress, disabled, secondary }: { label: string; onPress: () => void; disabled?: boolean; secondary?: boolean }) { return <Button label={label} onPress={onPress} modifiers={[buttonStyle(secondary ? 'bordered' : 'borderedProminent'), controlSize('large'), inactive(!!disabled), frame({ maxWidth: Infinity, minHeight: 56 })]} />; }
export function Toggle({ label, value, onChange, disabled }: { label: string; value: boolean; onChange: (value: boolean) => void; disabled?: boolean }) { return <NativeToggle label={label} isOn={value} onIsOnChange={onChange} modifiers={[inactive(!!disabled)]} />; }
export function Label({ children }: { children: string }) { return <Text>{children}</Text>; }
export function InlineBusy(){return <ProgressView/>;}
export function Gap({ size = 12 }: { size?: number }) { return <VStack modifiers={[frame({ height: size })]}>{null}</VStack>; }

export function Select({ label, value, options, onChange, disabled }: { label: string; value: string | null; options: { value: string; label: string }[]; onChange: (value: string) => void; disabled?: boolean }) {
  return <Picker label={label} selection={value} onSelectionChange={value => { if (value !== null) onChange(value); }} modifiers={[pickerStyle('menu'), inactive(!!disabled), frame({ maxWidth: Infinity, minHeight: 48 })]}>{options.map(option => <Text key={option.value} modifiers={[tag(option.value)]}>{option.label}</Text>)}</Picker>;
}
export function ActionRow({ actions }: { actions: { label: string; onPress: () => void; disabled?: boolean; secondary?: boolean }[] }) {
  return <HStack spacing={10} modifiers={[frame({ maxWidth: Infinity })]}>{actions.map((action, index) => <Button key={index} label={action.label} onPress={action.onPress} modifiers={[buttonStyle(action.secondary ? 'bordered' : 'borderedProminent'), controlSize('large'), inactive(!!action.disabled), frame({ maxWidth: Infinity, minHeight: 48 })]} />)}</HStack>;
}

export function ChoiceChips({ options,disabled }: { options:{ label:string;selected:boolean;onChange:(value:boolean)=>void }[];disabled?:boolean }) { return <VStack alignment="leading" spacing={8}>{options.map((option,index) => <NativeToggle key={index} label={option.label} isOn={option.selected} onIsOnChange={option.onChange} modifiers={[inactive(!!disabled)]} />)}</VStack>; }
export const Check = Toggle;
export function Columns({ children }: { children:ReactNode[] }) { return <HStack spacing={8} modifiers={[frame({ maxWidth:Infinity })]}>{children.map((child,index) => <VStack key={index} modifiers={[frame({ maxWidth:Infinity })]}>{child}</VStack>)}</HStack>; }
export function FieldsRow({children,action}:{children:ReactNode[];action?:ReactElement}){return <HStack alignment="top" spacing={8} modifiers={[frame({maxWidth:Infinity})]}>{children.map((child,index)=><VStack key={index} modifiers={[frame({maxWidth:Infinity})]}>{child}</VStack>)}{action?<RNHostView matchContents>{action}</RNHostView>:null}</HStack>;}
