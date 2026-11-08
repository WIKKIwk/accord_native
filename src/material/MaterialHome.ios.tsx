import { Section, Text } from '@expo/ui/swift-ui';
import { Stack } from 'expo-router';
import { PreparationList } from '../preparation/PreparationUI';
import { useMaterialContext } from './MaterialContext';
import { useMaterialScope } from './useMaterialScope';

// This partial shell is not tagged as V2 coverage until the actions and native FAB are implemented.
export function MaterialHome() {
  const { session } = useMaterialContext(), { groups, refresh } = useMaterialScope(session);
  return <><Stack.Screen options={{ title: 'Material ta’minotchisi' }} /><PreparationList refresh={refresh}>
    {!groups.length && <Section><Text>Mahsulot guruhi biriktirilmagan</Text>
      <Text>Homashyo qabul qilish va zakazga ulash uchun admin avval material guruhini biriktirishi kerak.</Text></Section>}
  </PreparationList></>;
}
