import { Button, HStack, Image, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import { accessibilityIdentifier, accessibilityLabel, buttonStyle, font, frame } from '@expo/ui/swift-ui/modifiers';
import { werkaArchivePeriodGridPresentation, type WerkaArchivePeriodGridProps } from './werkaArchivePeriodPresentation';

/** Inline native grid, inside the owner's SwiftUI Host. No load, shell or route is bound. */
export function WerkaArchivePeriodGrid(props: WerkaArchivePeriodGridProps) {
  const model = werkaArchivePeriodGridPresentation(props);
  return <VStack spacing={12}>
    <HStack>
      <Button onPress={() => props.onPageStep(-1)} modifiers={[buttonStyle('borderless'),
        frame({ minWidth: 44, minHeight: 44 }), accessibilityLabel(model.previousLabel), accessibilityIdentifier(model.previousId)]}>
        <Image systemName="chevron.left" />
      </Button><Spacer /><Text>{model.pageLabel}</Text><Spacer />
      <Button onPress={() => props.onPageStep(1)} modifiers={[buttonStyle('borderless'),
        frame({ minWidth: 44, minHeight: 44 }), accessibilityLabel(model.nextLabel), accessibilityIdentifier(model.nextId)]}>
        <Image systemName="chevron.right" />
      </Button>
    </HStack>
    {model.rows.map((row, index) => <HStack key={index} spacing={10}>{row.map(cell =>
      <Button key={cell.id} onPress={() => props.onSelect(cell.query)} modifiers={[
        buttonStyle(cell.active ? 'borderedProminent' : 'bordered'), accessibilityIdentifier(cell.id)]}>
        <Text modifiers={[frame({ maxWidth: Infinity, minHeight: 44 }), font({ textStyle: 'body', weight: cell.active ? 'bold' : 'medium' })]}>{cell.label}</Text>
      </Button>)}</HStack>)}
    {model.emptyLabel !== null ? <Text>{model.emptyLabel}</Text> : null}
  </VStack>;
}
