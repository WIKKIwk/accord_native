import { ListItem } from '@expo/ui';
import { Column, RNHostView, Text } from '@expo/ui/jetpack-compose';
import { SymbolView } from 'expo-symbols';
import type { AdminWorkMapComboModel } from './adminWorkMapComboPresentation';
import { useAdminWorkMapCombo } from './useAdminWorkMapCombo';
export function AdminWorkMapCombo({ model }: { model: AdminWorkMapComboModel }) {
  const { expanded, toggle } = useAdminWorkMapCombo();
  return <Column>
    <ListItem testID="admin-work-map-combo" onPress={toggle} trailing={<RNHostView matchContents><SymbolView name={{ android: expanded ? 'expand_less' : 'expand_more' }} importantForAccessibility="no" size={24} /></RNHostView>}><Text>{model.title}</Text></ListItem>
    {expanded && <><Text>{model.version}</Text><Text style={{ typography: 'titleSmall' }}>{model.name}</Text><Text>{model.code}</Text>
      <Text>{model.componentsTitle}</Text>{model.products.map((product, index) => <Text key={index}>{product}</Text>)}</>}
  </Column>;
}
