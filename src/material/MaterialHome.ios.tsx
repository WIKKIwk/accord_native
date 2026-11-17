import { Button, HStack, Image, Section, Text } from '@expo/ui/swift-ui';
import { frame } from '@expo/ui/swift-ui/modifiers';
import { Stack } from 'expo-router';
import { View } from 'react-native';
import { PreparationList } from '../preparation/PreparationUI';
import { RoleFab } from '../shared/navigation/RoleFab.ios';
import { useMaterialContext } from './MaterialContext';
import { materialHomeActions, type MaterialHomeHandlers } from './materialHomeActions';
import { useMaterialScope } from './useMaterialScope';

// @v2 MaterialTaminotchiHomeScreen
export function MaterialHome({ handlers }: { handlers?: MaterialHomeHandlers } = {}) {
  const { session, witness } = useMaterialContext(), { groups, refresh } = useMaterialScope(session, witness);
  const actions = materialHomeActions(session, handlers);
  return <View style={{ flex: 1 }}><Stack.Screen options={{ title: 'Material ta’minotchisi' }} /><PreparationList refresh={refresh}>
    {!groups.length && <Section><Text>Mahsulot guruhi biriktirilmagan</Text>
      <Text>Homashyo qabul qilish va zakazga ulash uchun admin avval material guruhini biriktirishi kerak.</Text></Section>}
    {!!actions.cards.length && <Section>{actions.cards.map(item => <Button key={item.id} onPress={() => actions.select(item.id)}>
      <HStack spacing={14} modifiers={[frame({ minHeight: 44 })]}><Image systemName={item.icon.ios} size={23} />
        <Text modifiers={[frame({ maxWidth: Infinity, alignment: 'leading' })]}>{item.label}</Text>
        <Image systemName="chevron.right" size={16} /></HStack>
    </Button>)}</Section>}
  </PreparationList>
    {!!actions.fab.length && handlers && <RoleFab actions={actions.fab.map(item => ({ ...item, icon: item.icon.ios }))}
      onSelect={actions.select} isCurrent={handlers.isCurrent} resetKey={session.imageCacheScope} bottomOffset={16}
      testIDPrefix="material-home-fab" openLabel="Amallar" closeLabel="Yopish" />}
  </View>;
}
