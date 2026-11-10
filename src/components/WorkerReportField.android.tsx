import { useNativeState } from '@expo/ui';
import { Host, OutlinedTextField, Text, type TextFieldRef } from '@expo/ui/jetpack-compose';
import { fillMaxWidth } from '@expo/ui/jetpack-compose/modifiers';
import { useEffect, useRef } from 'react';
import type { WorkerReportFieldProps } from './workerReportFieldTypes';

export function WorkerReportField({ label, value, change, decimal, multiline, disabled, focus }: WorkerReportFieldProps) {
  const native = useNativeState(value), input = useRef<TextFieldRef>(null);
  useEffect(() => { if (native.get() !== value) native.set(value); }, [native, value]);
  useEffect(() => { if (focus && !disabled) void input.current?.focus(); }, [focus, disabled]);
  return <Host matchContents={{ vertical: true }} style={{ width: '100%' }}><OutlinedTextField ref={input} value={native} onValueChange={change}
    enabled={!disabled} singleLine={!multiline} keyboardOptions={{ keyboardType: decimal ? 'decimal' : 'text' }} modifiers={[fillMaxWidth()]}>
    <OutlinedTextField.Label><Text>{label}</Text></OutlinedTextField.Label>
  </OutlinedTextField></Host>;
}
