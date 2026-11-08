import { Button, HStack, Image, Section, Text } from '@expo/ui/swift-ui';
import { frame } from '@expo/ui/swift-ui/modifiers';
import { Stack } from 'expo-router';
import { PreparationList } from '../preparation/PreparationUI';
import { useMaterialContext } from './MaterialContext';
import { materialHomeActions, type MaterialHomeHandlers } from './materialHomeActions';
import { useMaterialScope } from './useMaterialScope';

// This partial shell is not tagged as V2 coverage until the actions and native FAB are implemented.
export function MaterialHome({ handlers }: { handlers?: MaterialHomeHandlers } = {}) {
  const { session } = useMaterialContext(), { groups, refresh } = useMaterialScope(session);
  const actions = materialHomeActions(session, handlers);
  return <><Stack.Screen options={{ title: 'Material ta’minotchisi' }} /><PreparationList refresh={refresh}>
    {!groups.length && <Section><Text>Mahsulot guruhi biriktirilmagan</Text>
      <Text>Homashyo qabul qilish va zakazga ulash uchun admin avval material guruhini biriktirishi kerak.</Text></Section>}
    {!!actions.cards.length && <Section>{actions.cards.map(item => <Button key={item.id} onPress={() => actions.select(item.id)}>
      <HStack spacing={14}><Image systemName={item.icon.ios} size={23} />
        <Text modifiers={[frame({ maxWidth: Infinity, alignment: 'leading' })]}>{item.label}</Text>
        <Image systemName="chevron.right" size={16} /></HStack>
    </Button>)}</Section>}
  </PreparationList></>;
}
