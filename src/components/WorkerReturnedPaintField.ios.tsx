import { Text, TextField, useNativeState, VStack, type TextFieldRef } from '@expo/ui/swift-ui';
import { accessibilityLabel, autocorrectionDisabled, background, contentShape, cornerRadius, disabled, font, foregroundStyle, frame, keyboardType, multilineTextAlignment, padding, shapes, strokeBorder, textFieldStyle, textInputAutocapitalization } from '@expo/ui/swift-ui/modifiers';
import { useRef, type ComponentProps } from 'react';
import { PlatformColor } from 'react-native';
import type { ReturnedPaintField } from '../boyoqchi/BoyoqchiFormContent';
import { boyoqchiInputAllowed } from '../boyoqchi/boyoqchiLogic';
import { useBoyoqchiText } from '../boyoqchi/useBoyoqchiText';
import { BaseHost } from './BaseHost';

type Props = Pick<ComponentProps<typeof ReturnedPaintField>, 'label' | 'initial' | 'decimal' | 'disabled' | 'isLocked' | 'onChange'>;

/** Native worker editor; the shared formatter still owns which paint values are accepted. */
export function WorkerReturnedPaintField({ label, initial = '', decimal = false, disabled: inactive = false, isLocked, onChange }: Props) {
  const text = useNativeState(initial), input = useRef<TextFieldRef>(null), last = useRef(initial), t = useBoyoqchiText();
  return <BaseHost matchContents={{ vertical: true }} style={{ width: '100%' }}>
    <VStack alignment="leading" spacing={6} modifiers={[frame({ maxWidth: Infinity, alignment: 'leading' })]}>
      <Text modifiers={[font({ textStyle: 'subheadline' }), foregroundStyle({ type: 'hierarchical', style: 'secondary' })]}>{t(label)}</Text>
      <TextField ref={input} text={text} axis="horizontal" onTextChange={value => {
        if (inactive || isLocked?.() || (decimal && !boyoqchiInputAllowed(value))) { text.set(last.current); return; }
        // Native owns valid typing; do not echo React updates back into the text/caret.
        last.current = value; onChange(value);
      }} onFocusChange={focused => {
        if (focused && decimal) {
          const end = text.get().length;
          void input.current?.setSelection(end, end).catch(() => {});
        }
      }} modifiers={[textFieldStyle('plain'), font({ textStyle: 'body' }), foregroundStyle(PlatformColor('label')), accessibilityLabel(t(label)),
        disabled(inactive), textInputAutocapitalization('never'), multilineTextAlignment('leading'),
        ...(decimal ? [keyboardType('decimal-pad'), autocorrectionDisabled()] : []),
        padding({ horizontal: 12, vertical: 8 }), frame({ maxWidth: Infinity, minHeight: 48, alignment: 'leading' }),
        background(PlatformColor('tertiarySystemFill')), cornerRadius(10),
        strokeBorder({ color: PlatformColor('separator'), shape: 'roundedRectangle', cornerRadius: 10, style: { lineWidth: 0.5 } }),
        contentShape(shapes.rectangle())]} />
    </VStack>
  </BaseHost>;
}
