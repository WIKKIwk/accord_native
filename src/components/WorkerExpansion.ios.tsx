import { Button, HStack, Image, Text } from '@expo/ui/swift-ui';
import { accessibilityValue, buttonStyle, fixedSize, font, foregroundStyle, frame, multilineTextAlignment } from '@expo/ui/swift-ui/modifiers';
import { BaseHost } from './BaseHost';

type Props = { title: string; count: string; expanded: boolean; onPress?: () => void };

export function WorkerExpansion({ title, count, expanded, onPress }: Props) {
  const label = <HStack spacing={8} modifiers={[frame({ maxWidth: Infinity, minHeight: 44, alignment: 'leading' })]}>
    <Text modifiers={[font({ size: 16, weight: 'medium' }), foregroundStyle('primary'), multilineTextAlignment('leading'),
      frame({ maxWidth: Infinity, alignment: 'leading' }), fixedSize({ horizontal: false, vertical: true })]}>{title}</Text>
    {!!count && <Text modifiers={[font({ textStyle: 'subheadline' }), foregroundStyle('secondary'), fixedSize({ horizontal: true })]}>{count}</Text>}
    {onPress ? <Image systemName={expanded ? 'chevron.up' : 'chevron.down'} size={16} modifiers={[foregroundStyle('secondary')]} /> : null}
  </HStack>;
  return <BaseHost matchContents={{ vertical: true }} style={{ width: '100%' }}>
    {onPress ? <Button onPress={onPress} modifiers={[buttonStyle('plain'), accessibilityValue(expanded ? 'Ochiq' : 'Yopiq')]}>{label}</Button> : label}
  </BaseHost>;
}
