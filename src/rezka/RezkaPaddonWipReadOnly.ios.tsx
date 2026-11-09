import { Host, RNHostView, Text, VStack } from '@expo/ui/swift-ui';
import { fixedSize, font, foregroundStyle } from '@expo/ui/swift-ui/modifiers';
import { PlatformColor, Text as NativeText } from 'react-native';
import { productionText } from '../shared/localization';
import { rezkaPaddonWipContent } from './rezkaPaddonWipModel';
import type { RezkaPaddonWipReadOnlyProps } from './rezkaPaddonWipTypes';
import { useRezkaPaddonDetailAccess } from './useRezkaPaddonDetailAccess';
import { useRezkaLocale } from './useRezkaShell';

/** Passive, unconnected content; it intentionally has no reprint or selection actions. */
export function RezkaPaddonWipReadOnly({ snapshot, binding }: RezkaPaddonWipReadOnlyProps) {
  const locale = useRezkaLocale(), allowed = useRezkaPaddonDetailAccess(snapshot);
  if (!allowed || binding.owner !== snapshot) return null;
  let content: ReturnType<typeof rezkaPaddonWipContent>;
  try { content = rezkaPaddonWipContent(binding.batch, binding.catalog, snapshot.session.profile, key => productionText(key, locale)); }
  catch (error) { if (error instanceof RangeError) return null; throw error; }
  return <Host matchContents={{ vertical: true }} style={{ width: '100%' }}><VStack alignment="leading" spacing={8}>
    <Text modifiers={[font({ textStyle: 'body', weight: 'bold' }), fixedSize({ horizontal: false, vertical: true })]}>{content.order}</Text>
    {content.peremotka ? <Text>{content.peremotka}</Text> : null}
    {content.rows.map(row => <VStack key={row.key} alignment="leading" spacing={3}>
      <Text modifiers={[font({ textStyle: 'caption' }), foregroundStyle('secondary')]}>{row.label}</Text>
      {row.selectable ? <RNHostView matchContents={{ vertical: true }}><NativeText selectable
        style={{ color: PlatformColor('label'), fontFamily: 'monospace', fontSize: 13, writingDirection: 'ltr', textAlign: 'left' }}>{row.value}</NativeText></RNHostView>
        : <Text modifiers={[fixedSize({ horizontal: false, vertical: true })]}>{row.value}</Text>}
    </VStack>)}
  </VStack></Host>;
}
