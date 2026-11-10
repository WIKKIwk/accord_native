import { Button, HStack, Image, List, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import { buttonStyle, font, foregroundStyle, listStyle, padding } from '@expo/ui/swift-ui/modifiers';
import { BaseHost } from './BaseHost';
import type { WorkerPaddonPickerProps } from './workerPaddonPresentation';

export function WorkerPaddonPicker({ choices, choose, compact }: WorkerPaddonPickerProps) {
  const rows = choices.map(choice => <Button key={choice.id}
    role={choice.destructive ? 'destructive' : undefined} onPress={() => choose(choice.id)} modifiers={[buttonStyle('plain')]}>
    <HStack spacing={12} modifiers={[padding({ vertical: 8 })]}><Image systemName={choice.destructive ? 'trash' : 'shippingbox'} size={22} />
      <VStack alignment="leading" spacing={4}><Text>{choice.title}</Text>{choice.subtitle ? <Text modifiers={[font({ textStyle: 'subheadline' }), foregroundStyle('secondary')]}>{choice.subtitle}</Text> : null}</VStack><Spacer />
    </HStack>
  </Button>);
  return compact ? <BaseHost matchContents={{ vertical: true }} style={{ width: '100%' }}><VStack modifiers={[padding({ horizontal: 16, vertical: 20 })]}>{rows}</VStack></BaseHost>
    : <BaseHost style={{ flex: 1 }}><List modifiers={[listStyle('plain')]}>{rows}</List></BaseHost>;
}
