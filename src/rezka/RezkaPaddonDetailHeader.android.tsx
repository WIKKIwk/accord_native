import { Column, Host, Row, Text, useMaterialColors } from '@expo/ui/jetpack-compose';
import { WorkerQueueCard } from '../components/WorkerQueueCard.android';
import { adminText, localizedMethod, productionText } from '../shared/localization';
import { rezkaPaddonDetailHeader } from './rezkaPaddonDetailModel';
import type { RezkaPaddonDetailHeaderProps } from './rezkaPaddonDetailHeaderTypes';
import { useRezkaPaddonDetailAccess } from './useRezkaPaddonDetailAccess';
import { useRezkaLocale } from './useRezkaShell';

/** Unconnected display fragment. The host must bind data to the same guarded witness. */
export function RezkaPaddonDetailHeader({ snapshot, data, catalog }: RezkaPaddonDetailHeaderProps) {
  const locale = useRezkaLocale(), colors = useMaterialColors(), allowed = useRezkaPaddonDetailAccess(snapshot);
  if (!allowed) return null;
  let content: ReturnType<typeof rezkaPaddonDetailHeader>;
  try {
    content = rezkaPaddonDetailHeader(data, catalog, key => productionText(key, locale), adminText('wip.unspecified', locale),
      count => localizedMethod('productionCount', locale, { count }));
  } catch (error) { if (error instanceof RangeError) return null; throw error; }
  return <WorkerQueueCard first last backgroundColor={colors.surfaceContainerLowest}><Host matchContents={{ vertical: true }} style={{ width: '100%' }}>
    <Column verticalArrangement={{ spacedBy: 14 }}>
      <Column verticalArrangement={{ spacedBy: 4 }}><Text style={{ typography: 'titleLarge' }}>{content.code}</Text>
        {content.peremotka ? <Text color={colors.error}>{content.peremotka}</Text> : null}{content.location ? <Text>{content.location}</Text> : null}</Column>
      <Column verticalArrangement={{ spacedBy: 4 }}><Text color={colors.onSurfaceVariant} style={{ typography: 'labelMedium' }}>{content.creatorLabel}</Text>
        <Text style={{ typography: 'bodyLarge' }}>{content.creator}</Text></Column>
      <Column verticalArrangement={{ spacedBy: 8 }}><Text>{content.gross}</Text><Text>{content.net}</Text></Column>
      <Row horizontalArrangement={{ spacedBy: 8 }}>{content.locked ? <Text>{content.locked}</Text> : null}<Text>{content.wip}</Text></Row>
      {content.bobinaTitle ? <Column verticalArrangement={{ spacedBy: 8 }}><Text style={{ typography: 'labelLarge' }}>{content.bobinaTitle}</Text>
        {content.bobina.map(group => <Row key={group.units} horizontalArrangement={{ spacedBy: 8 }}><Text>{group.label}</Text><Text>{group.countText}</Text></Row>)}</Column> : null}
      {content.note ? <Text>{content.note}</Text> : null}
    </Column>
  </Host></WorkerQueueCard>;
}
