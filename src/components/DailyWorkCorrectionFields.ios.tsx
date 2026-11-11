import { Text, TextField, useNativeState, VStack, type TextFieldRef } from '@expo/ui/swift-ui';
import { accessibilityLabel, autocorrectionDisabled, background, contentShape, cornerRadius, disabled, font, foregroundStyle, frame, keyboardType, lineLimit, multilineTextAlignment, padding, shapes, strokeBorder, textFieldStyle, textInputAutocapitalization } from '@expo/ui/swift-ui/modifiers';
import { useCallback, useRef } from 'react';
import { PlatformColor } from 'react-native';
import { scheduleOnRN } from 'react-native-worklets';
import { BaseHost } from './BaseHost';
import type { DailyWorkCorrectionFieldsProps } from './dailyWorkCorrectionFieldsTypes';
import { useWorkerOrderText } from './useWorkerOrderText';

function CorrectionField({ label, value, change, decimal = false, saving = false, maskDecimal = true, multiline = true }: {
  label: string; value: string; change: (value: string) => void; decimal?: boolean; saving?: boolean; maskDecimal?: boolean; multiline?: boolean;
}) {
  const text = useNativeState(value), selection = useNativeState({ start: 0, end: 0 }), input = useRef<TextFieldRef>(null);
  // Keep typing/selection on the UI thread; a JS state echo can overwrite newer keystrokes.
  const changed = useCallback((incoming: string) => {
    'worklet';
    const next = decimal && maskDecimal ? incoming.replace(/[^0-9.,]/g, '') : incoming;
    if (next !== incoming) {
      text.set(next);
      selection.set({ start: next.length, end: next.length });
    }
    scheduleOnRN(change, next);
  }, [change, decimal, maskDecimal, selection, text]);
  return <VStack alignment="leading" spacing={6} modifiers={[frame({ maxWidth: Infinity, alignment: 'leading' })]}>
    <Text modifiers={[font({ textStyle: 'subheadline' }), foregroundStyle({ type: 'hierarchical', style: 'secondary' })]}>{label}</Text>
    <TextField ref={input} text={text} selection={selection} onTextChange={changed} axis={!decimal && multiline ? 'vertical' : 'horizontal'}
      onFocusChange={focused => {
        if (focused && decimal) {
          const end = text.get().length;
          void input.current?.setSelection(end, end).catch(() => {});
        }
      }}
      modifiers={[textFieldStyle('plain'), font({ textStyle: 'body' }), foregroundStyle(PlatformColor('label')), accessibilityLabel(label),
        disabled(saving), textInputAutocapitalization('never'), multilineTextAlignment('leading'),
        ...(decimal ? [keyboardType('decimal-pad'), autocorrectionDisabled()] : multiline ? [lineLimit({ min: 2, max: 4 })] : []),
        padding({ horizontal: 12, vertical: 8 }), frame({ maxWidth: Infinity, minHeight: 48, alignment: 'leading' }),
        background(PlatformColor('tertiarySystemFill')), cornerRadius(10),
        strokeBorder({ color: PlatformColor('separator'), shape: 'roundedRectangle', cornerRadius: 10, style: { lineWidth: 0.5 } }),
        contentShape(shapes.rectangle())]} />
  </VStack>;
}

export { CorrectionField as WorkerNativeField };

export function DailyWorkCorrectionFields({ edit, controller }: DailyWorkCorrectionFieldsProps) {
  const { p } = useWorkerOrderText();
  return <BaseHost matchContents={{ vertical: true }} style={{ width: '100%' }}>
    <VStack alignment="leading" spacing={14} modifiers={[frame({ maxWidth: Infinity })]}>
      {edit.step === 'edit' ? <>
        {edit.fields.map(field => <CorrectionField key={`${edit.batch.id}:${field.key}`} label={`${p(`worker.daily.field.${field.label}`)} (${field.unit})`} value={edit.values[field.key]} decimal
          change={value => controller.change(field.key, value)} />)}
        <CorrectionField key={`${edit.batch.id}:description`} label={p('worker.daily.field.note')} value={edit.values.description}
          change={value => controller.change('description', value)} />
      </> : <CorrectionField key={`${edit.batch.id}:reason`} label={p('worker.daily.correction.hint')} value={edit.reason} change={controller.reason} saving={edit.step === 'saving'} />}
    </VStack>
  </BaseHost>;
}
