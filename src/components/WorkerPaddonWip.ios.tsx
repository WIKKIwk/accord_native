import { HStack, Image, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import { font, foregroundStyle, frame, padding } from '@expo/ui/swift-ui/modifiers';
import { BaseHost } from './BaseHost';
import type { rezkaPaddonWipContent } from '../rezka/rezkaPaddonWipModel';

export type WorkerPaddonWipProps = { content: ReturnType<typeof rezkaPaddonWipContent>; selected?: boolean; selectable?: boolean; selectionIcon?: 'add' | 'remove' | 'close' };
export function WorkerPaddonWipContent({ content, selected, selectable, selectionIcon }: WorkerPaddonWipProps) {
  return <VStack alignment="leading" spacing={9} modifiers={[frame({ maxWidth: Infinity, alignment: 'leading' }), padding({ vertical: 8 })]}>
    <HStack spacing={12}><Text modifiers={[font({ textStyle: 'headline' })]}>{content.order}</Text><Spacer />
      {selectable ? <Image systemName={selected ? 'checkmark.circle.fill' : selectionIcon === 'close' ? 'xmark.circle' : selectionIcon === 'remove' ? 'minus.circle' : 'plus.circle'} size={24} /> : null}</HStack>
    {content.peremotka ? <Text modifiers={[foregroundStyle('secondary')]}>{content.peremotka}</Text> : null}
    {content.rows.map(row => <HStack key={row.key} alignment="top" spacing={16}>
      <Text modifiers={[font({ textStyle: 'subheadline' }), foregroundStyle('secondary'), frame({ width: 120, alignment: 'leading' })]}>{row.label}</Text>
      <Text modifiers={[font({ textStyle: row.isEpc ? 'caption' : 'subheadline', ...(row.isEpc ? { design: 'monospaced' as const } : {}) }), frame({ maxWidth: Infinity, alignment: 'leading' })]}>{row.value}</Text>
    </HStack>)}
  </VStack>;
}
export function WorkerPaddonWipCard(props: WorkerPaddonWipProps) { return <BaseHost matchContents={{ vertical: true }} style={{ width: '100%' }}><WorkerPaddonWipContent {...props} /></BaseHost>; }
