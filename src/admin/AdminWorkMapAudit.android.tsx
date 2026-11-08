import { ListItem } from '@expo/ui';
import { Button, Column, RNHostView, Row, Text, useMaterialColors } from '@expo/ui/jetpack-compose';
import { fillMaxWidth, padding, testID, weight } from '@expo/ui/jetpack-compose/modifiers';
import { SymbolView } from 'expo-symbols';
import { ActivityIndicator } from 'react-native';
import type { AdminWorkMapAuditProps } from './adminWorkMapAuditTypes';

export function AdminWorkMapAudit({ model, onRefresh }: AdminWorkMapAuditProps) {
  const colors = useMaterialColors();
  return <Column modifiers={[fillMaxWidth(), padding(12, 12, 12, 12)]}>
    <Row modifiers={[fillMaxWidth()]}>
      <RNHostView matchContents><SymbolView name={{ android: model.clean ? 'verified' : 'warning_amber' }} importantForAccessibility="no" size={30} tintColor={model.clean ? colors.primary : colors.error} /></RNHostView>
      <Text modifiers={[weight(1)]} style={{ typography: 'titleMedium', fontWeight: '700' }}>{model.title}</Text>
      {model.loading ? <RNHostView matchContents><ActivityIndicator /></RNHostView> : <Button onClick={() => { void onRefresh(); }} enabled={model.canRefresh} modifiers={[testID('admin-work-map-audit-refresh')]}><Text>{model.refreshLabel}</Text></Button>}
    </Row>
    <Text color={colors.onSurfaceVariant}>{model.description}</Text>
    {model.counts.map(count => <Text key={count.id}>{count.text}</Text>)}
    {!!model.error && <Text color={colors.error}>{model.error}</Text>}
    {model.violations.map(row => <ListItem key={row.key} supportingText={row.subtitle}
      leading={<RNHostView matchContents><SymbolView name={{ android: 'error_outline' }} importantForAccessibility="no" size={24} tintColor={colors.error} /></RNHostView>}><Text>{row.title}</Text></ListItem>)}
    {model.successTitle != null && <ListItem supportingText={model.successDescription ?? undefined}
      leading={<RNHostView matchContents><SymbolView name={{ android: 'check_circle_outline' }} importantForAccessibility="no" size={24} tintColor={colors.primary} /></RNHostView>}><Text>{model.successTitle}</Text></ListItem>}
    {model.initialProgress && <RNHostView matchContents><ActivityIndicator /></RNHostView>}
  </Column>;
}
