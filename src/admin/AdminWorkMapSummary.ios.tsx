import { ListItem } from '@expo/ui';
import { Button, Divider, Image, Text, VStack } from '@expo/ui/swift-ui';
import { accessibilityHidden, font } from '@expo/ui/swift-ui/modifiers';
import type { AdminWorkMapSummaryModel } from './adminWorkMapSummaryPresentation';
export function AdminWorkMapSummary({ model, onToggle, onRetry }: { model: AdminWorkMapSummaryModel; onToggle: () => void; onRetry: () => void }) {
  return <VStack alignment="leading" spacing={8}>
    <ListItem testID="admin-work-map-summary" onPress={model.canExpand ? onToggle : undefined}
      trailing={<Image systemName={model.expanded ? 'chevron.up' : 'chevron.down'} modifiers={[accessibilityHidden()]} />}><Text>{model.title}</Text></ListItem>
    {model.blocks.map(block => block.kind === 'divider' ? <Divider key={block.id} />
      : block.kind === 'retry' ? <Button key={block.id} label={block.label} systemImage="arrow.clockwise" onPress={onRetry} />
      : block.kind === 'row' ? <ListItem key={block.id} supportingText={block.value}><Text>{block.label}</Text></ListItem>
      : <Text key={block.id} modifiers={[font({ textStyle: block.kind === 'heading' ? 'headline' : 'subheadline' })]}>{block.label}</Text>)}
  </VStack>;
}
