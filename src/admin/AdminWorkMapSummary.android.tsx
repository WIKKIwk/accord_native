import { ListItem } from '@expo/ui';
import { Button, Column, HorizontalDivider, RNHostView, Text } from '@expo/ui/jetpack-compose';
import { SymbolView } from 'expo-symbols';
import type { AdminWorkMapSummaryModel } from './adminWorkMapSummaryPresentation';
export function AdminWorkMapSummary({ model, onToggle, onRetry }: { model: AdminWorkMapSummaryModel; onToggle: () => void; onRetry: () => void }) {
  return <Column>
    <ListItem testID="admin-work-map-summary" onPress={model.canExpand ? onToggle : undefined}
      trailing={<RNHostView matchContents><SymbolView name={{ android: model.expanded ? 'expand_less' : 'expand_more' }} importantForAccessibility="no" size={24} /></RNHostView>}><Text>{model.title}</Text></ListItem>
    {model.blocks.map(block => block.kind === 'divider' ? <HorizontalDivider key={block.id} />
      : block.kind === 'retry' ? <Button key={block.id} onClick={onRetry}><Text>{block.label}</Text></Button>
      : block.kind === 'row' ? <ListItem key={block.id} supportingText={block.value}><Text>{block.label}</Text></ListItem>
      : <Text key={block.id} style={{ typography: block.kind === 'heading' ? 'titleSmall' : 'bodySmall' }}>{block.label}</Text>)}
  </Column>;
}
