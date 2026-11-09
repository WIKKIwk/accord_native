import { Column, Host, RNHostView, Text, useMaterialColors } from '@expo/ui/jetpack-compose';
import { Text as NativeText } from 'react-native';
import { WorkerQueueCard } from '../components/WorkerQueueCard.android';
import { productionText } from '../shared/localization';
import { isRezkaPaddonDetailBinding } from './rezkaPaddonDetailRead';
import { rezkaPaddonWipContent } from './rezkaPaddonWipModel';
import type { RezkaPaddonWipReadOnlyProps } from './rezkaPaddonWipTypes';
import { useRezkaPaddonDetailAccess } from './useRezkaPaddonDetailAccess';
import { useRezkaLocale } from './useRezkaShell';

/** Passive, unconnected content; it intentionally has no reprint or selection actions. */
export function RezkaPaddonWipReadOnly({ snapshot, binding, index }: RezkaPaddonWipReadOnlyProps) {
  const locale = useRezkaLocale(), colors = useMaterialColors(), allowed = useRezkaPaddonDetailAccess(snapshot, binding);
  if (!allowed || !isRezkaPaddonDetailBinding(binding, snapshot) || !Number.isInteger(index) || index < 0 || index >= binding.data.items.length) return null;
  let content: ReturnType<typeof rezkaPaddonWipContent>;
  try { content = rezkaPaddonWipContent(binding.data.items[index], binding.catalog, snapshot.session.profile, key => productionText(key, locale)); }
  catch (error) { if (error instanceof RangeError) return null; throw error; }
  return <WorkerQueueCard first last backgroundColor={colors.surfaceContainerLowest}><Host matchContents={{ vertical: true }} style={{ width: '100%' }}>
    <Column verticalArrangement={{ spacedBy: 8 }}>
      <Text style={{ typography: 'bodyMedium', fontWeight: 'bold' }}>{content.order}</Text>
      {content.peremotka ? <Text color={colors.error}>{content.peremotka}</Text> : null}
      {content.rows.map(row => <Column key={row.key} verticalArrangement={{ spacedBy: 3 }}>
        <Text color={colors.onSurfaceVariant} style={{ typography: 'bodySmall' }}>{row.label}</Text>
        {row.isEpc ? <RNHostView matchContents={{ vertical: true }}><NativeText
          style={{ color: colors.onSurface, fontFamily: 'monospace', fontSize: 13, writingDirection: 'ltr', textAlign: 'left' }}>{row.value}</NativeText></RNHostView>
          : <Text style={{ typography: 'bodyMedium' }}>{row.value}</Text>}
      </Column>)}
    </Column>
  </Host></WorkerQueueCard>;
}
