import { Button, Checkbox, Column, Host, IconButton, RNHostView, Row, Text, useMaterialColors } from '@expo/ui/jetpack-compose';
import { fillMaxWidth, semantics, testID } from '@expo/ui/jetpack-compose/modifiers';
import { Stack } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useEffect, useSyncExternalStore } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WorkerQueueCard } from '../components/WorkerQueueCard.android';
import { useNativeSheet } from '../nativeSheet';
import { RoleHeader } from '../shared/navigation/RoleHeader.android';
import type { RezkaWorkerSettingsProps } from './rezkaWorkerScreenTypes';
import { apparatusLabels, type RezkaWorkerSettingsController } from './rezkaWorkerController';
import { useRezkaAdminText, useRezkaWorkerSettings } from './useRezkaWorkerSettings';

const levels: Record<string, string> = { Brigader: 'brigader', Master: 'master', '1 - darajali': 'one', '2 - darajali': 'two', '3 - darajali': 'three' };

function AssignmentPicker({ controller }: { controller: RezkaWorkerSettingsController }) {
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  const t = useRezkaAdminText(), picker = state.picker, team = state.team;
  if (!picker || !team) return null;
  return <View style={{ minHeight: 420, maxHeight: 650, paddingHorizontal: 16, paddingBottom: 16 }}>
    <Host matchContents={{ vertical: true }} style={{ width: '100%' }}><Column>
      <Text style={{ typography: 'titleLarge' }}>{t('scope.operator_title')}</Text><Text>{picker.worker.name}</Text>
      <IconButton enabled={!picker.saving} onClick={() => controller.closePicker()} modifiers={[semantics({ contentDescription: t('action.close') })]}>
        <RNHostView matchContents><SymbolView name={{ android: 'close' }} size={22} /></RNHostView>
      </IconButton>
      <Text>{t('rezka_master.rezka_apparatus_required')}</Text><Text>{t('scope.allowed')}</Text>
    </Column></Host>
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingVertical: 8 }}>
      <Host matchContents={{ vertical: true }} style={{ width: '100%' }}><Column>
        {team.apparatus.map(item => <Row key={item.id} verticalAlignment="center">
          <Checkbox value={picker.selected.includes(item.id)} enabled={!picker.saving && !!item.id}
            onCheckedChange={value => controller.toggle(item.id, value)} modifiers={[semantics({ contentDescription: item.name })]} />
          <Text>{item.name}</Text>
        </Row>)}
      </Column></Host>
    </ScrollView>
    {picker.blocked ? <View accessibilityRole="alert" accessibilityLiveRegion="polite">
      <Host matchContents={{ vertical: true }}><Text>{t(picker.blocked.key, picker.blocked.values)}</Text></Host></View> : null}
    <Host matchContents={{ vertical: true }} style={{ width: '100%' }}><Column>
      <Button enabled={!picker.saving && !!picker.selected.length} onClick={() => { void controller.save(); }}
        modifiers={[fillMaxWidth(), testID('worker-apparatus-save')]}><Text>{t(picker.saving ? 'action.saving' : 'scope.save_action')}</Text></Button>
    </Column></Host>
  </View>;
}

// Master-only branch of V2 AdminWorkerSettingsScreen; no route is attached yet.
export function RezkaWorkerSettingsScreen({ session, navigation, footer }: RezkaWorkerSettingsProps) {
  const { controller, state, t, notice } = useRezkaWorkerSettings(session), sheet = useNativeSheet();
  const colors = useMaterialColors();
  useEffect(() => { if (!state.picker && sheet.isOpen()) sheet.close(); }, [sheet, state.picker]);
  const openPicker = (id: string) => {
    controller.openPicker(id);
    if (controller.getSnapshot().picker?.worker.id !== id) return;
    sheet.open(<AssignmentPicker controller={controller} />, { dismissible: true, onDismiss: () => controller.dismissPicker() });
  };
  const assignments = new Map((state.team?.assignments ?? []).map(item => [item.principal_ref, item]));
  return <SafeAreaView edges={['top', 'left', 'right']} style={{ flex: 1, backgroundColor: colors.background }}>
    <Stack.Screen options={{ headerShown: false }} />
    <RoleHeader title={t('worker.title')} navigation={navigation ?? undefined} />
    {state.notice ? <View accessibilityRole="alert" accessibilityLiveRegion="polite" style={{ padding: 12, backgroundColor: state.notice.tone === 'error' ? '#FCE8E6' : '#E6F4EA' }}>
      <Host matchContents={{ vertical: true }} style={{ width: '100%' }}><Text color={state.notice.tone === 'error' ? '#5F1412' : '#173A24'}>{notice(state.notice)}</Text></Host></View> : null}
    <ScrollView style={{ flex: 1 }} refreshControl={<RefreshControl refreshing={state.phase === 'loading'} onRefresh={() => { void controller.load(); }} />}>
      {state.phase === 'loading' ? <ActivityIndicator /> : null}
      {state.phase === 'error' ? <Host matchContents><Text>{t('worker.load_failed')}</Text></Host> : null}
      {state.phase === 'ready' && !state.team?.workers.length ? <Host matchContents><Text>{t('worker.empty')}</Text></Host> : null}
      {state.phase === 'ready' ? state.team?.workers.map(worker => {
        const level = levels[worker.level] ?? 'three', expanded = state.expandedId === worker.id;
        const assigned = assignments.get(worker.id.trim())?.assigned_apparatus ?? [];
        const labels = apparatusLabels(assigned, state.team?.apparatus ?? []), saving = state.savingIds.includes(worker.id.trim());
        return <WorkerQueueCard key={worker.id} first last backgroundColor={colors.surfaceContainerLowest}>
          <View style={{ flex: 1 }}>
            <Pressable accessibilityRole="button" accessibilityState={{ expanded }} testID={`worker-settings-card-${worker.id}`}
              onPress={() => controller.expand(worker.id)}>
              <Host matchContents={{ vertical: true }} style={{ width: '100%' }}><Column>
                <Text style={{ typography: 'titleMedium' }}>{worker.name}</Text>
                <Text style={{ typography: 'bodySmall' }}>{[t(`worker.level.${level}`), worker.phone].filter(Boolean).join(' • ')}</Text>
              </Column></Host>
            </Pressable>
            {expanded ? <Host matchContents={{ vertical: true }} style={{ width: '100%' }}><Column>
              <Text style={{ typography: 'labelLarge' }}>{t('worker.worker_details', { name: worker.name })}</Text>
              <Row><Text>{t('worker.name_label')}</Text><Text>{worker.name}</Text></Row>
              <Row><Text>{t('worker.level')}</Text><Text>{t(`worker.level.${level}`)}</Text></Row>
              <Row><Text>{t('worker.phone_label')}</Text><Text>{worker.phone || t('worker.not_entered')}</Text></Row>
              <Row><Text>{t('worker.id')}</Text><Text>{worker.id}</Text></Row>
              <Button enabled={!saving && !!state.team?.apparatus.length} onClick={() => openPicker(worker.id)}
                modifiers={[fillMaxWidth(), testID(`worker-apparatus-picker-${worker.id}`)]}>
                <Column><Text>{t('scope.operator_title')}</Text><Text>{labels.length ? labels.join(', ') : t('scope.none_selected')}</Text></Column>
              </Button>
            </Column></Host> : null}
          </View>
        </WorkerQueueCard>;
      }) : null}
    </ScrollView>
    {footer}
  </SafeAreaView>;
}
