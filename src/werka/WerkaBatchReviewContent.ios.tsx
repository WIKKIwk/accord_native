import { Button, HStack, Host, Image, Section, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import { accessibilityLabel, buttonStyle, disabled, font, frame } from '@expo/ui/swift-ui/modifiers';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PreparationList } from '../preparation/PreparationUI.ios';
import { werkaBatchReviewPresentation, type WerkaBatchReviewContentProps } from './werkaBatchReviewModel';

/** Controlled review body. The submit action and route are deliberately unbound. */
export function WerkaBatchReviewContent(props: WerkaBatchReviewContentProps) {
  const view = werkaBatchReviewPresentation(props.lines, props.submitting, props.locale), insets = useSafeAreaInsets();
  return <View style={{ flex: 1 }}>
    <PreparationList><Section><VStack alignment="leading" spacing={8}>
      <Text modifiers={[font({ textStyle: 'title2' })]}>{view.title}</Text>
      <HStack spacing={8}><Text>{view.customers}</Text><Text>{view.drafts}</Text></HStack>
    </VStack></Section><Section>
      {view.rows.map((row, index) => <HStack key={`${row.localID}:${index}`}>
        <VStack alignment="leading" spacing={4}><Text>{row.customer}</Text><Text>{row.item}</Text><Text>{row.detail}</Text></VStack><Spacer />
        <Button onPress={() => { if (view.canRemove) props.onRemove(row.localID); }}
          modifiers={[disabled(!view.canRemove), accessibilityLabel(view.deleteTooltip)]}><Image systemName="trash" /></Button>
      </HStack>)}
    </Section></PreparationList>
    <View style={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 20 }}>
      <Host matchContents={{ vertical: true }} style={{ width: '100%' }}><VStack alignment="leading" spacing={10}>
        {view.needAtLeastTwo !== null ? <Text>{view.needAtLeastTwo}</Text> : null}
        <Button label={view.confirmLabel} modifiers={[buttonStyle('borderedProminent'), frame({ maxWidth: Infinity }), disabled(true)]} />
      </VStack></Host>
    </View>
  </View>;
}
