import { Button, Image, Section, Text, VStack } from '@expo/ui/swift-ui';
import { disabled } from '@expo/ui/swift-ui/modifiers';
import { PreparationList } from '../preparation/PreparationUI.ios';
import { werkaBatchSuccessPresentation, type WerkaBatchSuccessContentProps } from './werkaBatchOutcomeModel';

/** Displays supplied counts only. Return navigation remains closed. */
export function WerkaBatchSuccessContent(props: WerkaBatchSuccessContentProps) {
  const view = werkaBatchSuccessPresentation(props);
  return <PreparationList><Section><VStack alignment="center" spacing={12}>
    <Image systemName="checkmark.seal.fill" size={44} /><Text>{view.created}</Text><Text>{view.detail}</Text>
  </VStack></Section><Section><Button label={view.returnLabel} modifiers={[disabled(true)]} /></Section></PreparationList>;
}
