import { Box, CircularProgressIndicator, Column, IconButton, RNHostView, Row, Spacer, Surface, TextButton } from '@expo/ui/jetpack-compose';
import { AdminTopBar } from './AdminTopBar.android';
import { defaultMinSize, fillMaxWidth, height, padding, semantics, size, testID, weight } from '@expo/ui/jetpack-compose/modifiers';
import { SymbolView, type AndroidSymbol } from 'expo-symbols';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSharedValue } from 'react-native-reanimated';
import { BaseHost } from '../components/BaseHost.android';
import { useBaseTheme } from '../components/useBaseTheme';
import { useAdminShellTheme } from './useAdminShellTheme';
import { OrdersList } from '../shared/orders/OrdersList.android';
import { AdminLoadingIndicator } from './AdminLoadingIndicator.android';
import { AdminShellBodyFrame } from './AdminShellBodyFrame';
import { AdminText as Text } from './AdminTypography.android';
import { workerDetailAlpha, workerDetailSegmentShape, workerDetailShape } from './AdminWorkerDetailNative.android';
import type { AdminQueuePolicyScreenProps } from './AdminQueuePolicyTypes';
import { useAdminQueuePolicy } from './useAdminQueuePolicy';

type Model = ReturnType<typeof useAdminQueuePolicy>;
function QueueIcon({ name, color, iconSize = 18 }: { name: AndroidSymbol; color: string; iconSize?: number }) {
  return <RNHostView matchContents><SymbolView name={{ android: name }} tintColor={color} size={iconSize} importantForAccessibility="no" /></RNHostView>;
}
function QueuePolicyTile({ row, index, count, a }: { row: Model['rows'][number]; index: number; count: number; a: Model['a'] }) {
  const { colors } = useBaseTheme(), locked = row.policy.locked;
  const option = (value: 'strict_sequence' | 'free_pick', icon: AndroidSymbol, label: string) => {
    const selected = row.policy.policy === value, inactive = !row.enabled;
    const background = selected ? inactive ? workerDetailAlpha(colors.outlineVariant, .42) : colors.secondaryContainer : 'transparent';
    const foreground = inactive ? workerDetailAlpha(colors.onSurfaceVariant, selected ? .72 : .38) : selected ? colors.onSecondaryContainer : colors.onSurfaceVariant;
    return <Surface key={value} selected={selected} enabled={row.enabled} onClick={row.enabled ? () => row.change(value) : undefined}
      color={background} shape={workerDetailShape(10)} modifiers={[weight(1), testID(`admin-queue-policy-${row.apparatus.id}-${value}`)]}>
      <Row horizontalArrangement="center" verticalAlignment="center" modifiers={[padding(8, 10, 8, 10)]}>
        <QueueIcon name={icon} color={foreground} /><Spacer modifiers={[size(6, 1)]} />
        <Text maxLines={1} overflow="ellipsis" color={foreground} modifiers={[weight(1)]} style={{ typography: 'labelLarge', fontWeight: selected ? '700' : '500', textAlign: 'center' }}>{label}</Text>
        {selected && !inactive ? <><Spacer modifiers={[size(4, 1)]} /><QueueIcon name="check" color={foreground} iconSize={16} /></> : null}
      </Row>
    </Surface>;
  };
  return <View style={[styles.tile, { paddingTop: index ? 2 : 0 }]}><BaseHost matchContents={{ vertical: true }} style={styles.full}>
    <Surface color={locked ? colors.surfaceContainerHighest : colors.surface} shadowElevation={locked ? 0 : 2} tonalElevation={0}
      border={locked ? { color: workerDetailAlpha(colors.outlineVariant, .65), width: 1 } : undefined}
      shape={workerDetailSegmentShape(index, count)} modifiers={[fillMaxWidth()]}>
      <Column modifiers={[fillMaxWidth(), padding(14, 12, 14, 12)]}>
        <Row verticalAlignment="center" modifiers={[fillMaxWidth()]}>
          <Surface color={locked ? workerDetailAlpha(colors.outlineVariant, .35) : colors.secondaryContainer} shape={workerDetailShape(8)} modifiers={[size(30, 30)]}>
            <Box contentAlignment="center"><QueueIcon name="precision_manufacturing" color={locked ? workerDetailAlpha(colors.onSurfaceVariant, .55) : colors.onSecondaryContainer} iconSize={16} /></Box>
          </Surface><Spacer modifiers={[size(14, 1)]} />
          <Column modifiers={[weight(1)]}><Text maxLines={2} overflow="ellipsis" color={locked ? workerDetailAlpha(colors.onSurfaceVariant, .72) : colors.onSurface} style={{ typography: 'titleMedium', fontWeight: '700' }}>{row.title}</Text>
            {locked ? <><Spacer modifiers={[height(2)]} /><Text color={workerDetailAlpha(colors.onSurfaceVariant, .72)} style={{ typography: 'bodySmall', lineHeight: 12.6 }}>{a('queue.locked_hint')}</Text></> : null}
          </Column>{locked ? <QueueIcon name="lock_outline" color={workerDetailAlpha(colors.onSurfaceVariant, .55)} /> : row.saving ? <CircularProgressIndicator strokeWidth={2} modifiers={[size(18, 18)]} /> : null}
        </Row><Spacer modifiers={[height(12)]} />
        <Surface color={locked ? workerDetailAlpha(colors.outlineVariant, .22) : colors.surfaceContainerHighest} shape={workerDetailShape(12)} modifiers={[fillMaxWidth()]}>
          <Row horizontalArrangement={{ spacedBy: 4 }} modifiers={[fillMaxWidth(), padding(4, 4, 4, 4)]}>
            {option('strict_sequence', 'format_list_numbered', a('queue.strict'))}{option('free_pick', 'ads_click', a('queue.free'))}
          </Row>
        </Surface>
      </Column>
    </Surface>
  </BaseHost></View>;
}

/** @v2 AdminQueuePolicyScreen */
export function AdminQueuePolicyScreen(props: AdminQueuePolicyScreenProps) {
  const model = useAdminQueuePolicy(props), { colors, chromeBackground, framed } = useAdminShellTheme(), insets = useSafeAreaInsets(), width = useWindowDimensions().width;
  const headerOffset = useSharedValue(0), headerHeight = useSharedValue(0);
  if (!model.current || model.state.invalidated) return <View style={styles.root} />;
  return <View style={[styles.root, { paddingTop: insets.top, backgroundColor: chromeBackground }]}>
    <BaseHost matchContents={{ vertical: true }} style={styles.full}><AdminTopBar leading={<IconButton onClick={model.navigation.onPress} modifiers={[semantics({ contentDescription: model.navigation.label }), testID('admin-queue-policy-back')]}>
        <QueueIcon name={model.navigation.icon === 'back' ? 'arrow_back' : 'menu'} color={colors.onSurface} iconSize={24} /></IconButton>}
      title={<Text style={{ typography: 'titleLarge' }}>{model.a('queue.title')}</Text>}
      actions={props.profileAction ? <RNHostView matchContents>{props.profileAction}</RNHostView> : null} /></BaseHost>{props.topNotice}
    <AdminShellBodyFrame hasFooter={props.footer != null} testID="admin-queue-policy-body-frame"><View style={[styles.root, framed && { backgroundColor: colors.surfaceContainerHighest }]}>
      {model.state.loading && !model.state.data ? <View style={styles.center}><BaseHost matchContents><AdminLoadingIndicator /></BaseHost></View> :
        model.state.loadError != null && !model.state.data ? <View style={styles.retry}><BaseHost matchContents={{ vertical: true }} style={{ width: Math.min(360, Math.max(280, width * .88)), maxWidth: '100%' }}><Column horizontalAlignment="center">
          <Text color={colors.onSurfaceVariant} style={{ typography: 'bodyLarge', textAlign: 'center', lineHeight: 21.6 }}>{model.t('serverDisconnectedRetry')}</Text><Spacer modifiers={[height(16)]} />
          <TextButton onClick={model.reload} contentPadding={{ start: 12, top: 8, end: 12, bottom: 8 }} modifiers={[defaultMinSize({ minWidth: 0, minHeight: 0 })]}><Text style={{ typography: 'bodyMedium', fontWeight: '600' }}>{model.t('retry')}</Text></TextButton>
        </Column></BaseHost></View> : model.state.data ?
          <OrdersList rows={model.rows} renderRow={(row, index) => <QueuePolicyTile row={row} index={index} count={model.rows.length} a={model.a} />}
            rowKey={(row, index) => `${row.apparatus.id}:${index}`} active headerOffset={headerOffset} headerHeight={headerHeight} topInset={4} passthrough={() => true}
            footer={<View style={{ height: insets.bottom + 128 }} />}>
            <View style={[styles.intro, { marginBottom: model.rows.length ? 10 : 24 }]}><BaseHost matchContents={{ vertical: true }} style={styles.full}><Text color={colors.onSurfaceVariant} style={{ typography: 'bodySmall', lineHeight: 15.6 }}>{model.a('queue.intro')}</Text></BaseHost></View>
            {!model.rows.length ? <View style={styles.empty}><BaseHost matchContents><Text>{model.a('queue.empty')}</Text></BaseHost></View> : null}
          </OrdersList> : null}
    </View></AdminShellBodyFrame><View pointerEvents="box-none" style={styles.footer}>{props.footer}</View>
  </View>;
}
const styles = StyleSheet.create({ root: { flex: 1 }, full: { width: '100%' }, center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  retry: { alignItems: 'center', paddingHorizontal: 24, paddingVertical: 40 }, tile: { paddingHorizontal: 4 },
  intro: { paddingHorizontal: 8 }, empty: { alignItems: 'center', paddingHorizontal: 4 }, footer: { position: 'absolute', left: 0, right: 0, bottom: 0 } });

/** The same Source panel embedded in the apparatus hub or an apparatus detail. */
export function AdminQueuePolicyPanel(props: AdminQueuePolicyScreenProps) {
  const model = useAdminQueuePolicy(props);
  if (!model.current || model.state.invalidated) return null;
  return <View>{model.state.loading && !model.state.data ? <BaseHost matchContents><AdminLoadingIndicator /></BaseHost> : model.state.loadError && !model.state.data ? <BaseHost matchContents><Column><Text>{model.t('serverDisconnectedRetry')}</Text><TextButton onClick={model.reload}><Text>{model.t('retry')}</Text></TextButton></Column></BaseHost> : model.state.data ? <><BaseHost matchContents={{ vertical:true }} style={{ width:'100%' }}><Text>{model.a('queue.intro')}</Text>{!model.rows.length ? <Text>{model.a('queue.empty')}</Text> : null}</BaseHost>{model.rows.map((row,index) => <QueuePolicyTile key={row.apparatus.id} row={row} index={index} count={model.rows.length} a={model.a} />)}</> : null}</View>;
}
