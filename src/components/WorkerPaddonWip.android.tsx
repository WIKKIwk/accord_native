import { Column, Host, Row, Text, useMaterialColors } from '@expo/ui/jetpack-compose';
import { weight } from '@expo/ui/jetpack-compose/modifiers';
import type { rezkaPaddonWipContent } from '../rezka/rezkaPaddonWipModel';

export type WorkerPaddonWipProps = { content: ReturnType<typeof rezkaPaddonWipContent>; selected?: boolean; selectable?: boolean; selectionIcon?: 'add' | 'remove' | 'close' };
export function WorkerPaddonWipContent({ content, selected, selectable, selectionIcon }: WorkerPaddonWipProps) {
  const colors = useMaterialColors();
  return <Column verticalArrangement={{ spacedBy: 9 }}><Row horizontalArrangement={{ spacedBy: 12 }}>
    <Text style={{ typography: 'titleSmall' }} modifiers={[weight(1)]}>{content.order}</Text>{selectable ? <Text color={colors.primary}>{selected ? '✓' : selectionIcon === 'close' ? '×' : selectionIcon === 'remove' ? '−' : '+'}</Text> : null}
  </Row>{content.peremotka ? <Text color={colors.error}>{content.peremotka}</Text> : null}
    {content.rows.map(row => <Row key={row.key} horizontalArrangement={{ spacedBy: 16 }}>
      <Text color={colors.onSurfaceVariant} style={{ typography: 'bodySmall' }} modifiers={[weight(0.85)]}>{row.label}</Text>
      <Text style={{ typography: 'bodyMedium', ...(row.isEpc ? { fontFamily: 'monospace' as const } : {}) }} modifiers={[weight(1.3)]}>{row.value}</Text>
    </Row>)}
  </Column>;
}
export function WorkerPaddonWipCard(props: WorkerPaddonWipProps) { return <Host matchContents={{ vertical: true }} style={{ width: '100%' }}><WorkerPaddonWipContent {...props} /></Host>; }
