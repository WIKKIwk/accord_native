import { Button, Image, Section, Text, VStack } from '@expo/ui/swift-ui';
import { PreparationList } from '../preparation/PreparationUI.ios';
import { werkaSuccessPresentation, type WerkaSuccessContentProps } from './werkaSuccessPresentation';

/** Body only: caller owns the title, auth lifecycle, dock and safe navigation. */
export function WerkaSuccessContent(props: WerkaSuccessContentProps) {
  const view = werkaSuccessPresentation(props);
  return <PreparationList><Section><VStack alignment="center" spacing={12}>
    <Image systemName="checkmark.seal.fill" size={44} /><Text>{view.id}</Text><Text>{view.subtitle}</Text>
  </VStack></Section><Section><Button label={view.actionLabel} onPress={() => props.onReturn(view.target)} /></Section></PreparationList>;
}
