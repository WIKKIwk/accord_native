import { ListItem } from '@expo/ui';
import { Card, Column, IconButton, RNHostView, Row, Text, useMaterialColors } from '@expo/ui/jetpack-compose';
import { fillMaxWidth, padding, semantics, testID, weight } from '@expo/ui/jetpack-compose/modifiers';
import { SymbolView } from 'expo-symbols';
import { ActivityIndicator } from 'react-native';
import { AdminWorkMapAuditCounts } from './AdminWorkMapAuditCounts';
import type { AdminWorkMapAuditProps } from './adminWorkMapAuditTypes';

export function AdminWorkMapAudit({ model, onRefresh }: AdminWorkMapAuditProps) {
  const colors = useMaterialColors();
  return <Column modifiers={[fillMaxWidth(), padding(8, 8, 8, 8)]} verticalArrangement={{ spacedBy: 8 }}>
    <Card colors={{ containerColor: colors.surfaceContainerLowest }} modifiers={[fillMaxWidth()]}>
      <Column modifiers={[padding(16, 16, 16, 16)]} verticalArrangement={{ spacedBy: 12 }}>
        <Row modifiers={[fillMaxWidth()]} horizontalArrangement={{ spacedBy: 12 }} verticalAlignment="top">
          <RNHostView matchContents><SymbolView name={{ android: model.clean ? 'verified' : 'warning_amber' }} importantForAccessibility="no" size={30} tintColor={model.clean ? colors.primary : colors.error} /></RNHostView>
          <Column modifiers={[weight(1)]} verticalArrangement={{ spacedBy: 4 }}><Text style={{ typography: 'titleMedium', fontWeight: '800' }}>{model.title}</Text>
            <Text style={{ typography: 'bodySmall' }} color={colors.onSurfaceVariant}>{model.description}</Text></Column>
          <IconButton onClick={model.canRefresh ? () => { void onRefresh(); } : undefined} enabled={model.canRefresh}
            modifiers={[testID('admin-work-map-audit-refresh'), semantics({ contentDescription: model.refreshLabel })]}>
            <RNHostView matchContents>{model.loading ? <ActivityIndicator /> : <SymbolView name={{ android: 'refresh' }} size={24} importantForAccessibility="no" />}</RNHostView>
          </IconButton>
        </Row>
        {!!model.counts.length && <AdminWorkMapAuditCounts counts={model.counts} />}
        {model.error != null && <Text color={colors.error}>{model.error}</Text>}
      </Column>
    </Card>
    {model.violations.map(row => <Card key={row.key} colors={{ containerColor: colors.surfaceContainerLowest }} modifiers={[fillMaxWidth()]}><ListItem supportingText={row.subtitle}
      leading={<RNHostView matchContents><SymbolView name={{ android: 'error_outline' }} importantForAccessibility="no" size={24} tintColor={colors.error} /></RNHostView>}><Text style={{ fontWeight: '700' }}>{row.title}</Text></ListItem></Card>)}
    {model.successTitle != null && <Card colors={{ containerColor: colors.surfaceContainerLowest }} modifiers={[fillMaxWidth()]}><ListItem supportingText={model.successDescription ?? undefined}
      leading={<RNHostView matchContents><SymbolView name={{ android: 'check_circle_outline' }} importantForAccessibility="no" size={24} tintColor={colors.primary} /></RNHostView>}><Text>{model.successTitle}</Text></ListItem></Card>}
    {model.initialProgress && <RNHostView matchContents><ActivityIndicator /></RNHostView>}
  </Column>;
}
