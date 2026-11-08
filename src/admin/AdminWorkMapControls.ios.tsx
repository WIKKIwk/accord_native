import { Button, HStack, Picker, Text, VStack } from '@expo/ui/swift-ui';
import { accessibilityAddTraits, accessibilityLabel, font, pickerStyle, tag } from '@expo/ui/swift-ui/modifiers';
import type { AdminWorkMapControlsProps } from './adminWorkMapControlsTypes';

export function AdminWorkMapModules(props: AdminWorkMapControlsProps) {
  return <Picker label="" selection={props.module} onSelectionChange={value => {
    if (value === 'sequence' || value === 'orders' || value === 'audit') props.onModule(value);
  }} modifiers={[pickerStyle('segmented')]}>
    <Text modifiers={[tag('sequence')]}>Ketma-ketlik</Text><Text modifiers={[tag('orders')]}>Buyurtmalar</Text><Text modifiers={[tag('audit')]}>Tekshiruv</Text>
  </Picker>;
}
export function AdminWorkMapApparatusFilter(props: AdminWorkMapControlsProps) {
  return <VStack alignment="leading" spacing={6}>
    <Button onPress={props.onToggle} modifiers={[accessibilityLabel([props.apparatusLabel, props.selected?.name ?? props.unselectedLabel].join(', '))]}>
      <HStack><Text>{props.apparatusLabel}</Text><Text>{props.selected?.name ?? props.unselectedLabel}</Text></HStack>
    </Button>
    {props.expanded && props.catalog.map(item => <Button key={item.id} label={item.name} onPress={() => props.onApparatus(item.id)}
      modifiers={props.selected?.id === item.id ? [accessibilityAddTraits(['isSelected'])] : []} />)}
    {!!props.countText && <Text modifiers={[font({ textStyle: 'caption' })]}>{props.countText}</Text>}
  </VStack>;
}
