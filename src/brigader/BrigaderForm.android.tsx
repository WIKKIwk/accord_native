import { Button, Checkbox, FlowRow, FilterChip, DropdownMenu, DropdownMenuItem, Column, OutlinedButton, Spacer, Switch, Row, RNHostView, useNativeState } from '@expo/ui/jetpack-compose';
import { defaultMinSize, fillMaxWidth, height, padding, weight } from '@expo/ui/jetpack-compose/modifiers';
import { useEffect } from 'react';
import { BaseHost } from '../components/BaseHost.android';
import { AdminOutlinedTextField } from '../admin/AdminTextFields.android';
import { AdminText as Text } from '../admin/AdminTypography.android';
import { userCreateRounded } from '../admin/AdminUserCreateNative.android';
import { useBaseTheme } from '../components/useBaseTheme';
import type { ReactNode,ReactElement } from 'react';

export function Form({ children }: { children: ReactNode }) { return <BaseHost matchContents={{ vertical: true }} style={{ width: '100%' }}><Column modifiers={[fillMaxWidth(), padding(12, 12, 12, 24)]}>{children}</Column></BaseHost>; }
export function Field({ label, value, onChange, numeric, multiline, disabled, error,unit,hint }: { label: string; value: string; onChange: (value: string) => void; numeric?: boolean; multiline?: boolean; disabled?: boolean; error?: string;unit?:string;hint?:string }) {
  const state = useNativeState(value), { colors, mode } = useBaseTheme();
  useEffect(() => { state.set(value); }, [state, value]);
  return <Column modifiers={[fillMaxWidth(), padding(0, 0, 0, 12)]}><AdminOutlinedTextField value={state} onValueChange={onChange} singleLine={!multiline} enabled={!disabled} isError={!!error} shape={userCreateRounded(18)}
    keyboardOptions={{ keyboardType: numeric ? 'decimal' : 'text' }} colors={{ focusedContainerColor: mode === 'light' ? colors.surfaceBright : colors.surfaceContainerHighest, unfocusedContainerColor: mode === 'light' ? colors.surfaceBright : colors.surfaceContainerHighest }} modifiers={[fillMaxWidth()]}>
    <AdminOutlinedTextField.Label><Text>{label}</Text></AdminOutlinedTextField.Label>{hint ? <AdminOutlinedTextField.Placeholder><Text>{hint}</Text></AdminOutlinedTextField.Placeholder> : null}{unit ? <AdminOutlinedTextField.Suffix><Text>{unit}</Text></AdminOutlinedTextField.Suffix> : null}{error ? <AdminOutlinedTextField.SupportingText><Text color={colors.error}>{error}</Text></AdminOutlinedTextField.SupportingText> : null}
  </AdminOutlinedTextField></Column>;
}
export function Action({ label, onPress, disabled, secondary }: { label: string; onPress: () => void; disabled?: boolean; secondary?: boolean }) {
  const Component = secondary ? OutlinedButton : Button;
  return <Column modifiers={[fillMaxWidth(), padding(0, 6, 0, 6)]}><Component enabled={!disabled} onClick={onPress} shape={userCreateRounded(20)} modifiers={[fillMaxWidth(), defaultMinSize({ minHeight: 56 })]}><Text>{label}</Text></Component></Column>;
}
export function Toggle({ label, value, onChange, disabled }: { label: string; value: boolean; onChange: (value: boolean) => void; disabled?: boolean }) { return <Row verticalAlignment="center" modifiers={[fillMaxWidth(), padding(0, 8, 0, 8)]}><Text modifiers={[weight(1)]}>{label}</Text><Switch value={value} onCheckedChange={onChange} enabled={!disabled} /></Row>; }
export function Label({ children }: { children: string }) { return <Text style={{ typography: 'bodyMedium' }}>{children}</Text>; }
export function Gap({ size = 12 }: { size?: number }) { return <Spacer modifiers={[height(size)]} />; }

export function Select({ label, value, options, onChange, disabled }: { label: string; value: string | null; options: { value: string; label: string }[]; onChange: (value: string) => void; disabled?: boolean }) {
  return <Column modifiers={[fillMaxWidth(), padding(0, 4, 0, 12)]}><Text>{label}</Text><DropdownMenu><DropdownMenu.Trigger><OutlinedButton enabled={!disabled} modifiers={[fillMaxWidth(), defaultMinSize({ minHeight: 56 })]}><Text>{options.find(option => option.value === value)?.label ?? ''}</Text></OutlinedButton></DropdownMenu.Trigger><DropdownMenu.Items>{options.map(option => <DropdownMenuItem key={option.value} enabled={!disabled} onClick={() => onChange(option.value)}><DropdownMenuItem.Text><Text>{option.label}</Text></DropdownMenuItem.Text></DropdownMenuItem>)}</DropdownMenu.Items></DropdownMenu></Column>;
}
export function ActionRow({ actions }: { actions: { label: string; onPress: () => void; disabled?: boolean; secondary?: boolean }[] }) {
  return <Row horizontalArrangement={{ spacedBy: 10 }} modifiers={[fillMaxWidth(), padding(0, 6, 0, 6)]}>{actions.map((action, index) => { const Component = action.secondary ? OutlinedButton : Button; return <Component key={index} enabled={!action.disabled} onClick={action.onPress} shape={userCreateRounded(20)} modifiers={[weight(1), defaultMinSize({ minHeight: 48 })]}><Text>{action.label}</Text></Component>; })}</Row>;
}

export function ChoiceChips({ options,disabled }: { options:{ label:string;selected:boolean;onChange:(value:boolean)=>void }[];disabled?:boolean }) {
  return <FlowRow horizontalArrangement={{ spacedBy:8 }} verticalArrangement={{ spacedBy:8 }} modifiers={[fillMaxWidth()]}>{options.map((option,index) => <FilterChip key={index} selected={option.selected} enabled={!disabled} onClick={() => option.onChange(!option.selected)}><FilterChip.Label><Text>{option.label}</Text></FilterChip.Label></FilterChip>)}</FlowRow>;
}
export function Check({ label,value,onChange,disabled }: { label:string;value:boolean;onChange:(value:boolean)=>void;disabled?:boolean }) { return <Row verticalAlignment="center" modifiers={[fillMaxWidth(),defaultMinSize({ minHeight:56 })]}><Checkbox value={value} onCheckedChange={onChange} enabled={!disabled} /><Text modifiers={[weight(1)]}>{label}</Text></Row>; }
export function Columns({ children }: { children:ReactNode[] }) { return <Row horizontalArrangement={{ spacedBy:8 }} modifiers={[fillMaxWidth()]}>{children.map((child,index) => <Column key={index} modifiers={[weight(1)]}>{child}</Column>)}</Row>; }
export function FieldsRow({children,action}:{children:ReactNode[];action?:ReactElement}){return <Row verticalAlignment="top" horizontalArrangement={{spacedBy:8}} modifiers={[fillMaxWidth()]}>{children.map((child,index)=><Column key={index} modifiers={[weight(1)]}>{child}</Column>)}{action?<RNHostView matchContents>{action}</RNHostView>:null}</Row>;}
