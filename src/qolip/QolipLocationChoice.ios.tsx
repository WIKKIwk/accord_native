import { Button, Host, HStack, Image, List, Text, VStack } from '@expo/ui/swift-ui';
import { buttonStyle, font, listStyle } from '@expo/ui/swift-ui/modifiers';
import { View } from 'react-native';
import { localizedMethod } from '../shared/localization';
import { qolipLocationChoiceLabel } from './qolipLocationChoiceLabels';
import type { QolipLocationChoiceProps } from './qolipLocationChoiceProps';
import { useQolipLocationChoice } from './useQolipLocationChoice';
import { useQolipText } from './useQolipText';

// Unopened read-only sheet content. Choosing returns the original row; no attach/move/take/print action is dispatched.
export function QolipLocationChoice(props: QolipLocationChoiceProps) {
  const state = useQolipLocationChoice(props), { locale } = useQolipText();
  if (!state.valid) return null;
  return <View style={{ flex: 1, paddingHorizontal: 16, paddingBottom: 20 }}><Host style={{ flex: 1 }}>
    <VStack alignment="leading" spacing={12}><Text modifiers={[font({ size: 22, weight: 'bold' })]}>{props.title}</Text><List modifiers={[listStyle('plain')]}>
      {props.options.map((item, index) => {
        const label = qolipLocationChoiceLabel(item, localizedMethod('qolipCount', locale, { count: item.quantity }));
        return <Button key={`${item.id}:${index}`} onPress={() => state.choose(item)} modifiers={[buttonStyle('plain')]}>
          <HStack spacing={12}><Image systemName="square.stack.3d.up.fill" /><VStack alignment="leading">
            <Text>{label.title}</Text><Text>{label.subtitle}</Text>
          </VStack></HStack>
        </Button>;
      })}
    </List></VStack>
  </Host></View>;
}
