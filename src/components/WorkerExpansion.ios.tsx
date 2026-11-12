import { Button, HStack, Image, Spacer, Text } from '@expo/ui/swift-ui';
import { accessibilityValue, buttonStyle, fixedSize, font, foregroundStyle, frame, monospacedDigit, multilineTextAlignment } from '@expo/ui/swift-ui/modifiers';
import { BaseHost } from './BaseHost';
import { WORKER_ORDER_LAYOUT as layout } from './workerOrderLayout';

type Props = { title: string; count: string; expanded: boolean; onPress?: () => void; systemColors?: boolean };

export function WorkerExpansion({ title, count, expanded, onPress }: Props) {
  const label = <HStack spacing={layout.rowGap} modifiers={[frame({ maxWidth: Infinity, minHeight: layout.disclosureMinHeight, alignment: 'leading' }), fixedSize({ horizontal: false, vertical: true })]}>
    <Text modifiers={[font({ textStyle: 'body', weight: 'medium' }), foregroundStyle('primary'), multilineTextAlignment('leading'),
      frame({ maxWidth: Infinity, alignment: 'leading' }), fixedSize({ horizontal: false, vertical: true })]}>{title}</Text>
    {!!count && <Text modifiers={[font({ textStyle: 'subheadline', weight: 'medium' }), monospacedDigit(), foregroundStyle('secondary'),
      frame({ minWidth: layout.counterMinWidth, alignment: 'trailing' }), fixedSize({ horizontal: true, vertical: true })]}>{count}</Text>}
    {onPress ? <Image systemName={expanded ? 'chevron.up' : 'chevron.down'} size={layout.chevronWidth} modifiers={[foregroundStyle('secondary'), frame({ width: layout.chevronWidth })]} />
      : <Spacer modifiers={[frame({ width: layout.chevronWidth })]} />}
  </HStack>;
  return <BaseHost matchContents={{ vertical: true }} style={{ width: '100%' }}>
    {onPress ? <Button onPress={onPress} modifiers={[buttonStyle('plain'), fixedSize({ horizontal: false, vertical: true }), accessibilityValue(expanded ? 'Ochiq' : 'Yopiq')]}>{label}</Button> : label}
  </BaseHost>;
}
