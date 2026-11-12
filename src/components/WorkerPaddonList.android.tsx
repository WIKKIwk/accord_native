import { Column, Host, RNHostView, Row, Text, useMaterialColors } from '@expo/ui/jetpack-compose';
import { background, clip, fillMaxWidth, padding, weight } from '@expo/ui/jetpack-compose/modifiers';
import { SymbolView } from 'expo-symbols';
import { useEffect } from 'react';
import { ActivityIndicator, BackHandler, FlatList, RefreshControl, View } from 'react-native';
import { RoleFab, type RoleFabAction } from '../shared/navigation/RoleFab.android';
import { RoleHeader } from '../shared/navigation/RoleHeader.android';
import { RoleHeaderButton } from '../shared/navigation/RoleHeaderButton';
import { WorkerQueueCard } from './WorkerQueueCard.android';
import { WorkerOrderButton } from './WorkerOrderControls';
import { WorkerPaddonDialog } from './WorkerPaddonDialog';
import { WorkerPaddonFeedback } from './WorkerPaddonFeedback';
import { useWorkerPaddonList, type WorkerPaddonListProps } from './useWorkerPaddonList';

// @v2 AparatchiPaddonsScreen
export function WorkerPaddonList(props: WorkerPaddonListProps & { onProfile?: () => void }) {
  const { onBack } = props;
  const h = useWorkerPaddonList(props), { state, p } = h, colors = useMaterialColors();
  useEffect(() => {
    if (props.visible === false) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => { if (!h.presentation.isOpen()) onBack(); return true; });
    return () => sub.remove();
  }, [onBack, h.presentation, props.visible]);
  if (!h.current()) return null;
  const actions: RoleFabAction[] = [
    ...(h.canTransfer ? [{ id: 'transfer', label: p('worker.paddon.transfer.title'), icon: 'swap_vert' as const, width: 310 }] : []),
    ...(h.canCreate ? [{ id: 'create', label: p('worker.paddon.create'), icon: 'add' as const, width: 250 }] : []),
  ];
  const metric = (label: string, value: number) => <Text color={colors.onSurface} style={{ typography: 'labelLarge', fontWeight: 'bold' }} modifiers={[
    clip({ type: 'roundedCorner', radius: 12 }), background(colors.surfaceContainerHighest), padding(12, 8, 12, 8),
  ]}>{`${label}: ${value}`}</Text>;
  return <View style={{ flex: 1, backgroundColor: colors.background }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingRight: 10 }}>
      <View style={{ flex: 1 }}><RoleHeader title={h.title} subtitle={p('worker.paddon.subtitle')} navigation={{ icon: 'back', label: h.t('Orqaga'), onPress: props.onBack }} /></View>
      {props.onProfile ? <RoleHeaderButton icon="profile" label={h.t('Profil')} onPress={props.onProfile} tintColor={colors.onSurfaceVariant} /> : null}
    </View>
    {state.phase === 'loading' ? <ActivityIndicator style={{ flex: 1 }} /> : state.phase === 'error' ? <View style={{ flex: 1, padding: 20, gap: 16 }}>
      <Host matchContents><Text>{p('worker.paddon.load_failed')}</Text></Host><WorkerOrderButton label={h.t('Qayta urinish')} onPress={() => { void h.controller.load(); }} />
    </View> : <FlatList data={state.rows} keyExtractor={row => row.code} contentContainerStyle={{ paddingHorizontal: 4, paddingBottom: 112 }}
      refreshControl={<RefreshControl refreshing={false} onRefresh={() => { void h.controller.load(); }} tintColor={colors.primary} colors={[colors.primary]} />}
      ListHeaderComponent={!state.apparatus ? <View style={{ padding: 12, gap: 8 }}>{state.options.map(option => <WorkerOrderButton key={option.id}
        label={p('worker.paddon.apparatus', { apparatus: option.name })} onPress={() => { void h.controller.select(option.id); }} />)}</View>
        : <><WorkerQueueCard first last backgroundColor={colors.surfaceContainerLowest}><Host matchContents={{ vertical: true }} style={{ width: '100%', padding: 8 }}>
          <Column verticalArrangement={{ spacedBy: 10 }}>
            <Text color={colors.onSurface} style={{ typography: 'titleLarge', fontWeight: 'bold' }}>{p('worker.paddon.location.title')}</Text>
            <Text color={colors.onSurfaceVariant}>{p('worker.paddon.location.subtitle')}</Text>
            <Row horizontalArrangement={{ spacedBy: 8 }}>{metric(p('worker.paddons'), state.rows.length)}{metric(p('worker.daily.wip'), state.rows.reduce((sum, row) => sum + row.item_count, 0))}</Row>
          </Column></Host></WorkerQueueCard>
          <Host matchContents={{ vertical: true }} style={{ width: '100%', paddingHorizontal: 8, paddingTop: 4, paddingBottom: 8 }}>
            <Text color={colors.onSurface} style={{ typography: 'titleMedium', fontWeight: 'bold' }}>{h.title}</Text>
          </Host></>}
      ListEmptyComponent={state.apparatus ? <WorkerQueueCard first last backgroundColor={colors.surfaceContainerLowest}>
        <Host matchContents={{ vertical: true }} style={{ width: '100%', padding: 16 }}><Column horizontalAlignment="center" verticalArrangement={{ spacedBy: 8 }}>
          <Text style={{ typography: 'titleMedium' }}>{p('worker.paddon.empty.title')}</Text><Text color={colors.onSurfaceVariant}>{p('worker.paddon.empty.body')}</Text>
        </Column></Host></WorkerQueueCard> : undefined}
      renderItem={({ item: row, index }) => <WorkerQueueCard first={index === 0} last={index === state.rows.length - 1} backgroundColor={colors.surfaceContainerLowest}
        disabled={!h.enabled} onPress={() => h.open(row)} onLongPress={h.canDelete ? () => { void h.remove(row); } : undefined}>
        <Host matchContents={{ vertical: true }} style={{ width: '100%', paddingHorizontal: 8, paddingVertical: 5 }}>
          <Row verticalAlignment="center" horizontalArrangement={{ spacedBy: 12 }} modifiers={[fillMaxWidth()]}>
            <RNHostView matchContents><SymbolView name={{ android: 'inventory_2' }} size={25} tintColor={colors.primary} /></RNHostView>
            <Column verticalArrangement={{ spacedBy: 4 }} modifiers={[weight(1)]}>
              <Text color={colors.onSurface} style={{ typography: 'titleMedium', fontWeight: 'bold' }} maxLines={1}>{row.code}</Text>
              {row.contains_peremotka ? <Text color={colors.onSurfaceVariant} style={{ typography: 'bodySmall' }}>{p('worker.rezka.print.peremotka')}</Text> : null}
            </Column>
            <Text color={colors.primary} style={{ typography: 'labelLarge', fontWeight: 'bold' }} maxLines={1}>{p('worker.paddon.wip_count', { count: row.item_count })}</Text>
            <RNHostView matchContents><SymbolView name={{ android: 'chevron_right' }} size={24} tintColor={colors.onSurface} /></RNHostView>
          </Row>
        </Host>
      </WorkerQueueCard>} />}
    {actions.length ? <RoleFab actions={actions} bottomOffset={16} testIDPrefix="worker-paddon-fab" onSelect={id => {
      if (id === 'transfer' && h.canTransfer) h.transfer();
      else if (id === 'create' && h.canCreate) void h.create();
    }} /> : null}
    <WorkerPaddonDialog data={h.presentation.data} visible={h.presentation.visible} close={h.presentation.close} dismissed={h.presentation.dismissed} />
    <WorkerPaddonFeedback message={h.presentation.notice} />
  </View>;
}
