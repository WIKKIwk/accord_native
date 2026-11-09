import { ListItem } from '@expo/ui';
import { Image, Text, VStack } from '@expo/ui/swift-ui';
import { accessibilityHidden, font } from '@expo/ui/swift-ui/modifiers';
import type { AdminWorkMapComboModel } from './adminWorkMapComboPresentation';
import { useAdminWorkMapCombo } from './useAdminWorkMapCombo';
export function AdminWorkMapCombo({ model }: { model: AdminWorkMapComboModel }) {
  const { expanded, toggle } = useAdminWorkMapCombo();
  return <VStack alignment="leading" spacing={8}>
    <ListItem testID="admin-work-map-combo" onPress={toggle} trailing={<Image systemName={expanded ? 'chevron.up' : 'chevron.down'} modifiers={[accessibilityHidden()]} />}><Text>{model.title}</Text></ListItem>
    {expanded && <><Text>{model.version}</Text><Text modifiers={[font({ textStyle: 'headline' })]}>{model.name}</Text><Text>{model.code}</Text>
      <Text>{model.componentsTitle}</Text>{model.products.map((product, index) => <Text key={index}>{product}</Text>)}</>}
  </VStack>;
}
