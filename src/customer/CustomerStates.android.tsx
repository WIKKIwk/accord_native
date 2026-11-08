import { Card, Column, Host, LoadingIndicator, Shape, Surface, Text, TextButton, useMaterialColors } from '@expo/ui/jetpack-compose';
import { fillMaxWidth, paddingAll, semantics, size, testID } from '@expo/ui/jetpack-compose/modifiers';
import { useWindowDimensions, View } from 'react-native';
import { useCustomerText } from './CustomerContext';
import { customerLayoutDirection, customerRetryContentWidth } from './customerPresentation';

export function CustomerLoadingState() {
  const colors = useMaterialColors();
  return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
    <View style={{ width: 64, height: 64, alignItems: 'center', justifyContent: 'center' }}><Host matchContents>
      <LoadingIndicator color={colors.primary} modifiers={[size(48, 48), semantics({ contentDescription: 'Loading' })]} />
    </Host></View>
  </View>;
}

export function CustomerRetryState({ retry }: { retry: () => Promise<void> }) {
  const colors = useMaterialColors(), { text } = useCustomerText(), { width } = useWindowDimensions();
  return <View style={{ flex: 1, paddingHorizontal: 24, paddingVertical: 40, alignItems: 'center' }}>
    <Host matchContents={{ vertical: true }} style={{ width: '100%', maxWidth: customerRetryContentWidth(width) }}>
      <Column horizontalAlignment="center" verticalArrangement={{ spacedBy: 16 }} modifiers={[fillMaxWidth()]}>
        <Text color={colors.onSurfaceVariant} style={{ typography: 'bodyLarge', textAlign: 'center' }}>{text('serverDisconnectedRetry')}</Text>
        <TextButton onClick={() => { void retry(); }} colors={{ contentColor: colors.primary }}
          contentPadding={{ start: 12, end: 12, top: 8, bottom: 8 }} modifiers={[testID('customer-retry')]}>
          <Text style={{ typography: 'bodyMedium', fontWeight: '600' }}>{text('retry')}</Text>
        </TextButton>
      </Column>
    </Host>
  </View>;
}

export function CustomerEmptyStatusState() {
  const colors = useMaterialColors(), { text } = useCustomerText();
  return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><Host matchContents style={{ maxWidth: '100%' }}>
    <Card colors={{ containerColor: colors.surfaceContainerLow, contentColor: colors.onSurface }}>
      <Text style={{ typography: 'titleMedium' }} modifiers={[paddingAll(18)]}>{text('noRecordsYet')}</Text>
    </Card>
  </Host></View>;
}

/** V2 _NotificationPanel empty feed. */
export function CustomerEmptyFeedState() {
  const colors = useMaterialColors(), { locale, text } = useCustomerText();
  return <View style={{ marginHorizontal: 8 }}><Host matchContents={{ vertical: true }} style={{ width: '100%' }} layoutDirection={customerLayoutDirection(locale)}>
    <Surface color={colors.surfaceContainerLow} contentColor={colors.onSurface}
      shape={Shape.RoundedCorner({ cornerRadii: { topStart: 28, topEnd: 28, bottomStart: 28, bottomEnd: 28 } })} modifiers={[fillMaxWidth()]}>
      <Text style={{ typography: 'bodyMedium' }} modifiers={[paddingAll(16)]}>{text('noRecordsYet')}</Text>
    </Surface>
  </Host></View>;
}
