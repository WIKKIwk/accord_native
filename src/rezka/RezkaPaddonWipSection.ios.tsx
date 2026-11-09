import { Host, HStack, Text, VStack } from '@expo/ui/swift-ui';
import { fixedSize, font, foregroundStyle, multilineTextAlignment } from '@expo/ui/swift-ui/modifiers';
import { View } from 'react-native';
import { localizedMethod, productionText } from '../shared/localization';
import { RezkaPaddonWipReadOnly } from './RezkaPaddonWipReadOnly';
import { isRezkaPaddonDetailBinding } from './rezkaPaddonDetailRead';
import { rezkaPaddonWipSection } from './rezkaPaddonWipSectionModel';
import type { RezkaPaddonWipSectionProps } from './rezkaPaddonWipSectionTypes';
import { useRezkaPaddonDetailAccess } from './useRezkaPaddonDetailAccess';
import { useRezkaLocale } from './useRezkaShell';

/** Unconnected assigned-WIP section; no add, remove, reprint or filtering controls are exposed. */
export function RezkaPaddonWipSection({ snapshot, binding }: RezkaPaddonWipSectionProps) {
  const locale = useRezkaLocale(), allowed = useRezkaPaddonDetailAccess(snapshot);
  if (!allowed || !isRezkaPaddonDetailBinding(binding, snapshot)) return null;
  const section = rezkaPaddonWipSection(binding.data, key => productionText(key, locale),
    count => localizedMethod('productionCount', locale, { count }));
  return <View style={{ gap: 8 }}><Host matchContents={{ vertical: true }} style={{ width: '100%' }}><VStack alignment="leading" spacing={8}>
    {section.hint ? <Text modifiers={[fixedSize({ horizontal: false, vertical: true })]}>{section.hint}</Text> : null}
    <HStack spacing={12}><Text modifiers={[font({ textStyle: 'headline' })]}>{section.title}</Text>
      <Text modifiers={[font({ textStyle: 'caption' }), foregroundStyle('secondary')]}>{section.count}</Text></HStack>
  </VStack></Host>
    {section.empty ? <View style={{ padding: 24, alignItems: 'center' }}><Host matchContents={{ vertical: true }} style={{ width: '100%' }}>
      <Text modifiers={[fixedSize({ horizontal: false, vertical: true }), multilineTextAlignment('center')]}>{section.empty}</Text></Host></View> : null}
    {section.items.map((batch, index) => <RezkaPaddonWipReadOnly key={`${String(batch.batch_id)}:${index}`} snapshot={snapshot} binding={binding} index={index} />)}
  </View>;
}
