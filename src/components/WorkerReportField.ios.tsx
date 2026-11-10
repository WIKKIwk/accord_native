import { Text, TextField, VStack, useNativeState, type TextFieldRef } from '@expo/ui/swift-ui';
import { disabled, keyboardType, textFieldStyle } from '@expo/ui/swift-ui/modifiers';
import { useEffect, useRef } from 'react';
import { BaseHost } from './BaseHost';
import type { WorkerReportFieldProps } from './workerReportFieldTypes';

export function WorkerReportField({ label, value, change, decimal, multiline, disabled: inactive, focus }: WorkerReportFieldProps) {
  const native = useNativeState(value), input = useRef<TextFieldRef>(null);
  useEffect(() => { if (native.get() !== value) native.set(value); }, [native, value]);
  useEffect(() => { if (focus && !inactive) void input.current?.focus(); }, [focus, inactive]);
  return <BaseHost matchContents={{ vertical: true }} style={{ width: '100%' }}><VStack alignment="leading" spacing={6}>
    <Text>{label}</Text><TextField ref={input} text={native} onTextChange={change} axis={multiline ? 'vertical' : 'horizontal'}
      modifiers={[textFieldStyle('roundedBorder'), disabled(!!inactive), ...(decimal ? [keyboardType('decimal-pad')] : [])]} />
  </VStack></BaseHost>;
}
