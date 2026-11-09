import { Column, Host, Row, Text, useMaterialColors } from '@expo/ui/jetpack-compose';
import { fillMaxWidth, weight } from '@expo/ui/jetpack-compose/modifiers';
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
  const locale = useRezkaLocale(), colors = useMaterialColors(), allowed = useRezkaPaddonDetailAccess(snapshot, binding);
  if (!allowed || !isRezkaPaddonDetailBinding(binding, snapshot)) return null;
  const section = rezkaPaddonWipSection(binding.data, key => productionText(key, locale),
    count => localizedMethod('productionCount', locale, { count }));
  return <View style={{ gap: 8, paddingTop: 8 }}><Host matchContents={{ vertical: true }} style={{ width: '100%' }}><Column verticalArrangement={{ spacedBy: 12 }}>
    {section.hint ? <Text style={{ typography: 'bodyMedium' }}>{section.hint}</Text> : null}
    <Row horizontalArrangement={{ spacedBy: 12 }} modifiers={[fillMaxWidth()]}><Text modifiers={[weight(1)]} style={{ typography: 'titleMedium' }}>{section.title}</Text>
      <Text color={colors.primary} style={{ typography: 'labelLarge' }}>{section.count}</Text></Row>
  </Column></Host>
    {section.empty ? <View style={{ padding: 24, alignItems: 'center' }}><Host matchContents={{ vertical: true }} style={{ width: '100%' }}>
      <Text style={{ typography: 'bodyMedium', textAlign: 'center' }}>{section.empty}</Text></Host></View> : null}
    {section.items.map((batch, index) => <RezkaPaddonWipReadOnly key={`${String(batch.batch_id)}:${index}`} snapshot={snapshot} binding={binding} index={index} />)}
  </View>;
}
