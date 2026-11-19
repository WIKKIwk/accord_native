import { SymbolView } from 'expo-symbols';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import type { PanGesture } from 'react-native-gesture-handler';
import { useSharedValue } from 'react-native-reanimated';
import { BaseHost } from '../components/BaseHost.android';
import { useBaseTheme } from '../components/useBaseTheme';
import { WorkerIconButton } from '../components/WorkerIconButton';
import { WorkerQueueCard } from '../components/WorkerQueueCard.android';
import { OrdersList } from '../shared/orders/OrdersList';
import type { OrdersListProps } from '../shared/orders/OrdersList.types';
import { AdminWorkMapAuditCounts } from './AdminWorkMapAuditCounts';
import type { AdminWorkMapAuditProps } from './adminWorkMapAuditTypes';

const passthrough = () => true;

export function AdminWorkMapAudit({ model, onRefresh, active = true, pagerGesture, topInset = 0, userScrollPagination }: AdminWorkMapAuditProps & {
  active?: boolean; pagerGesture?: PanGesture; topInset?: number; userScrollPagination?: OrdersListProps['userScrollPagination'];
}) {
  const { colors } = useBaseTheme(), headerOffset = useSharedValue(0), headerHeight = useSharedValue(0);
  const statusColor = model.clean ? colors.primary : colors.error;
  const row = (title: string, subtitle: string, success: boolean, first: boolean, last: boolean) =>
    <WorkerQueueCard first={first} last={last} backgroundColor={colors.surfaceContainerLowest}>
      <SymbolView name={{ android: success ? 'check_circle_outline' : 'error_outline' }} importantForAccessibility="no" size={24} tintColor={success ? colors.primary : colors.error} />
      <View style={styles.text}><Text style={[styles.title, { color: colors.onSurface }]}>{title}</Text>
        {!!subtitle && <Text style={{ color: colors.onSurfaceVariant }}>{subtitle}</Text>}
      </View>
    </WorkerQueueCard>;
  return <OrdersList active={active} pagerGesture={pagerGesture} topInset={topInset} headerOffset={headerOffset} headerHeight={headerHeight}
    passthrough={passthrough} onRefresh={onRefresh} rows={model.violations} rowKey={finding => finding.key}
    userScrollPagination={userScrollPagination} renderRow={(finding, index) => row(finding.title, finding.subtitle, false,
      index === 0, index === model.violations.length - 1 && model.successTitle == null)}
    footer={<>
      {model.successTitle != null && row(model.successTitle, model.successDescription ?? '', true, !model.violations.length, true)}
      {model.initialProgress && <ActivityIndicator style={styles.progress} />}
    </>}>
    <WorkerQueueCard first last backgroundColor={colors.surfaceContainerLowest}>
      <View style={styles.report}>
        <View style={styles.heading}>
          <SymbolView name={{ android: model.clean ? 'verified' : 'warning_amber' }} importantForAccessibility="no" size={30} tintColor={statusColor} />
          <View style={styles.text}><Text style={[styles.title, { color: colors.onSurface }]}>{model.title}</Text>
            <Text style={{ color: colors.onSurfaceVariant }}>{model.description}</Text></View>
          <View testID="admin-work-map-audit-refresh">
            {model.loading ? <ActivityIndicator /> : model.canRefresh ?
              <WorkerIconButton icon="refresh" label={model.refreshLabel} onPress={() => { void onRefresh(); }} /> : null}
          </View>
        </View>
        {!!model.counts.length && <BaseHost matchContents={{ vertical: true }} style={{ width: '100%' }}><AdminWorkMapAuditCounts counts={model.counts} /></BaseHost>}
        {model.error != null && <Text style={{ color: colors.error }}>{model.error}</Text>}
      </View>
    </WorkerQueueCard>
  </OrdersList>;
}

const styles = StyleSheet.create({
  report: { flex: 1, padding: 8, gap: 12 }, heading: { flexDirection: 'row', alignItems: 'flex-start' },
  text: { flex: 1, marginStart: 12, gap: 4 }, title: { fontSize: 16, fontWeight: '700' }, progress: { padding: 8 },
});
