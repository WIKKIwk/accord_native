import { Button, Column, Host, IconButton, RNHostView, Row, Text, useMaterialColors } from '@expo/ui/jetpack-compose';
import { fillMaxWidth, semantics, weight } from '@expo/ui/jetpack-compose/modifiers';
import { SymbolView } from 'expo-symbols';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { werkaBatchReviewPresentation, type WerkaBatchReviewContentProps } from './werkaBatchReviewModel';

/** Controlled review body. The submit action and route are deliberately unbound. */
export function WerkaBatchReviewContent(props: WerkaBatchReviewContentProps) {
  const view = werkaBatchReviewPresentation(props.lines, props.submitting, props.locale), colors = useMaterialColors(), insets = useSafeAreaInsets();
  return <View style={{ flex: 1 }}><ScrollView contentContainerStyle={{ paddingHorizontal: 4, paddingTop: 4, paddingBottom: 48, gap: 4 }}>
    <Host matchContents={{ vertical: true }} style={{ width: '100%' }}><Column modifiers={[fillMaxWidth()]} verticalArrangement={{ spacedBy: 8 }}>
      <Text style={{ typography: 'headlineMedium' }}>{view.title}</Text><Row horizontalArrangement={{ spacedBy: 8 }}>
        <Text>{view.customers}</Text><Text>{view.drafts}</Text>
      </Row>
    </Column></Host>
    {view.rows.map((row, index) => <Host key={`${row.localID}:${index}`} matchContents={{ vertical: true }} style={{ width: '100%' }}>
      <Row modifiers={[fillMaxWidth()]} verticalAlignment="top">
        <Column modifiers={[weight(1)]} verticalArrangement={{ spacedBy: 4 }}>
          <Text style={{ typography: 'titleMedium' }}>{row.customer}</Text><Text style={{ typography: 'bodyLarge' }}>{row.item}</Text>
          <Text color={colors.onSurfaceVariant} style={{ typography: 'bodySmall' }}>{row.detail}</Text>
        </Column>
        <IconButton enabled={view.canRemove} onClick={() => { if (view.canRemove) props.onRemove(row.localID); }}
          modifiers={[semantics({ contentDescription: props.deleteLabel })]}>
          <RNHostView matchContents><SymbolView name={{ android: 'delete_outline' }} size={24} tintColor={colors.onSurfaceVariant} /></RNHostView>
        </IconButton>
      </Row>
    </Host>)}
  </ScrollView><View style={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 20 }}>
    <Host matchContents={{ vertical: true }} style={{ width: '100%' }}><Column modifiers={[fillMaxWidth()]} verticalArrangement={{ spacedBy: 10 }}>
      {view.needAtLeastTwo !== null ? <Text color={colors.onSurfaceVariant} style={{ typography: 'bodySmall' }}>{view.needAtLeastTwo}</Text> : null}
      <Button enabled={false} modifiers={[fillMaxWidth()]}><Text>{view.confirmLabel}</Text></Button>
    </Column></Host>
  </View></View>;
}
