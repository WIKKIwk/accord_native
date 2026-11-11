import { Divider, HStack, Text, TextField, useNativeState, VStack } from '@expo/ui/swift-ui';
import { accessibilityLabel, autocorrectionDisabled, background, cornerRadius, disabled, fixedSize, font, foregroundStyle, frame, keyboardType, lineLimit, multilineTextAlignment, padding, textFieldStyle, textInputAutocapitalization } from '@expo/ui/swift-ui/modifiers';
import { useEffect } from 'react';
import { PlatformColor } from 'react-native';
import { BaseHost } from './BaseHost';
import type { DailyWorkCorrectionFieldsProps } from './dailyWorkCorrectionFieldsTypes';
import { useWorkerOrderText } from './useWorkerOrderText';

function CorrectionField({ label, value, change, decimal = false, saving = false }: {
  label: string; value: string; change: (value: string) => void; decimal?: boolean; saving?: boolean;
}) {
  const text = useNativeState(value);
  useEffect(() => { if (text.get() !== value) text.set(value); }, [text, value]);
  const input = <TextField text={text} placeholder={decimal ? undefined : label} onTextChange={change} axis={decimal ? 'horizontal' : 'vertical'}
    modifiers={[textFieldStyle('plain'), font({ textStyle: 'body' }), foregroundStyle(PlatformColor('label')), accessibilityLabel(label),
      disabled(saving), textInputAutocapitalization('never'), ...(decimal ? [keyboardType('decimal-pad'), autocorrectionDisabled(),
        multilineTextAlignment('trailing'), frame({ minWidth: 90, maxWidth: 140, minHeight: 44 })] : [lineLimit(4), frame({ maxWidth: Infinity, minHeight: 44, alignment: 'leading' })])]} />;
  return decimal ? <HStack spacing={12} modifiers={[padding({ horizontal: 14, vertical: 4 }), frame({ maxWidth: Infinity, minHeight: 52 })]}>
    <Text modifiers={[font({ textStyle: 'body' }), frame({ maxWidth: Infinity, alignment: 'leading' }), fixedSize({ horizontal: false, vertical: true })]}>{label}</Text>
    {input}
  </HStack> : <VStack alignment="leading" spacing={8} modifiers={[padding({ all: 14 }), frame({ maxWidth: Infinity, alignment: 'leading' })]}>
    <Text modifiers={[font({ textStyle: 'footnote' }), foregroundStyle({ type: 'hierarchical', style: 'secondary' })]}>{label}</Text>
    {input}
  </VStack>;
}

export function DailyWorkCorrectionFields({ edit, controller }: DailyWorkCorrectionFieldsProps) {
  const { p } = useWorkerOrderText();
  return <BaseHost matchContents={{ vertical: true }} style={{ width: '100%' }}>
    <VStack alignment="leading" spacing={0} modifiers={[frame({ maxWidth: Infinity }), background(PlatformColor('tertiarySystemGroupedBackground')), cornerRadius(14)]}>
      {edit.step === 'edit' ? <>
        {edit.fields.map(field => <VStack key={`${edit.batch.id}:${field.key}`} spacing={0}>
          <CorrectionField label={`${p(`worker.daily.field.${field.label}`)} (${field.unit})`} value={edit.values[field.key]} decimal
            change={value => controller.change(field.key, value)} />
          <Divider modifiers={[padding({ leading: 14 })]} />
        </VStack>)}
        <CorrectionField key={`${edit.batch.id}:description`} label={p('worker.daily.field.note')} value={edit.values.description}
          change={value => controller.change('description', value)} />
      </> : <CorrectionField key={`${edit.batch.id}:reason`} label={p('worker.daily.correction.hint')} value={edit.reason} change={controller.reason} saving={edit.step === 'saving'} />}
    </VStack>
  </BaseHost>;
}
