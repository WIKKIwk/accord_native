import { Host, HStack, Text, VStack } from '@expo/ui/swift-ui';
import { fixedSize, font, foregroundStyle } from '@expo/ui/swift-ui/modifiers';
import { adminText, localizedMethod, productionText } from '../shared/localization';
import { rezkaPaddonDetailHeader } from './rezkaPaddonDetailModel';
import { isRezkaPaddonDetailBinding } from './rezkaPaddonDetailRead';
import type { RezkaPaddonDetailHeaderProps } from './rezkaPaddonDetailHeaderTypes';
import { useRezkaPaddonDetailAccess } from './useRezkaPaddonDetailAccess';
import { useRezkaLocale } from './useRezkaShell';

/** Unconnected display fragment; only a guarded detail binding is accepted. */
export function RezkaPaddonDetailHeader({ snapshot, binding }: RezkaPaddonDetailHeaderProps) {
  const locale = useRezkaLocale(), allowed = useRezkaPaddonDetailAccess(snapshot);
  if (!allowed || !isRezkaPaddonDetailBinding(binding, snapshot)) return null;
  let content: ReturnType<typeof rezkaPaddonDetailHeader>;
  try {
    content = rezkaPaddonDetailHeader(binding.data, binding.catalog, key => productionText(key, locale), adminText('wip.unspecified', locale),
      count => localizedMethod('productionCount', locale, { count }));
  } catch (error) { if (error instanceof RangeError) return null; throw error; }
  return <Host matchContents={{ vertical: true }} style={{ width: '100%' }}><VStack alignment="leading" spacing={14}>
    <VStack alignment="leading" spacing={4}><Text modifiers={[font({ textStyle: 'title3', weight: 'bold' })]}>{content.code}</Text>
      {content.peremotka ? <Text>{content.peremotka}</Text> : null}{content.location ? <Text>{content.location}</Text> : null}</VStack>
    <VStack alignment="leading" spacing={4}><Text modifiers={[font({ textStyle: 'caption' }), foregroundStyle('secondary')]}>{content.creatorLabel}</Text>
      <Text>{content.creator}</Text></VStack>
    <VStack alignment="leading" spacing={8}><Text modifiers={[fixedSize({ horizontal: false, vertical: true })]}>{content.gross}</Text>
      <Text modifiers={[fixedSize({ horizontal: false, vertical: true })]}>{content.net}</Text></VStack>
    <HStack spacing={8}>{content.locked ? <Text>{content.locked}</Text> : null}<Text>{content.wip}</Text></HStack>
    {content.bobinaTitle ? <VStack alignment="leading" spacing={8}><Text modifiers={[font({ textStyle: 'subheadline', weight: 'semibold' })]}>{content.bobinaTitle}</Text>
      {content.bobina.map(group => <HStack key={group.units} spacing={8}><Text>{group.label}</Text><Text>{group.countText}</Text></HStack>)}</VStack> : null}
    {content.note ? <Text modifiers={[fixedSize({ horizontal: false, vertical: true })]}>{content.note}</Text> : null}
  </VStack></Host>;
}
