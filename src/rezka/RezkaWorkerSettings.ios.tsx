import { ListItem } from '@expo/ui';
import { Button, Host, HStack, List, ProgressView, Section, Text, Toggle, VStack } from '@expo/ui/swift-ui';
import { accessibilityIdentifier, accessibilityLabel, buttonStyle, disabled, font, foregroundStyle, listStyle, refreshable } from '@expo/ui/swift-ui/modifiers';
import { Stack } from 'expo-router';
import { useEffect, useSyncExternalStore } from 'react';
import { PlatformColor, View } from 'react-native';
import { useNativeSheet } from '../nativeSheet';
import { RoleHeaderButton } from '../shared/navigation/RoleHeaderButton';
import type { RezkaWorkerSettingsProps } from './rezkaWorkerScreenTypes';
import { apparatusLabels, type RezkaWorkerSettingsController } from './rezkaWorkerController';
import { useRezkaAdminText, useRezkaNoticeText, useRezkaWorkerSettings } from './useRezkaWorkerSettings';

const levels: Record<string, string> = { Brigader: 'brigader', Master: 'master', '1 - darajali': 'one', '2 - darajali': 'two', '3 - darajali': 'three' };

function AssignmentPicker({ controller }: { controller: RezkaWorkerSettingsController }) {
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  const t = useRezkaAdminText(), notice = useRezkaNoticeText(), picker = state.picker, team = state.team;
  if (!picker || !team) return null;
  return <View style={{ minHeight: 420 }}><Host style={{ flex: 1 }}><VStack>
    <Text modifiers={[font({ textStyle: 'title2', weight: 'bold' })]}>{t('scope.operator_title')}</Text>
    <Text>{picker.worker.name}</Text>
    <Button role="close" modifiers={[disabled(picker.saving), accessibilityLabel(t('action.close'))]} onPress={() => controller.closePicker()} />
    <List modifiers={[listStyle('plain')]}>
      <Section><Text>{t('rezka_master.rezka_apparatus_required')}</Text></Section>
      <Section title={t('scope.allowed')}>
        {team.apparatus.map(item => <Toggle key={item.id} label={item.name} isOn={picker.selected.includes(item.id)}
          onIsOnChange={value => controller.toggle(item.id, value)} modifiers={[disabled(picker.saving || !item.id)]} />)}
      </Section>
    </List>
  </VStack></Host>
    {picker.blocked ? <View accessibilityRole="alert" accessibilityLiveRegion="polite"><Host matchContents={{ vertical: true }}><Text>{notice(picker.blocked)}</Text></Host></View> : null}
    <Host matchContents={{ vertical: true }}><Button label={t(picker.saving ? 'action.saving' : 'scope.save_action')}
      modifiers={[buttonStyle('borderedProminent'), disabled(picker.saving || !picker.selected.length || controller.isWriteLocked(picker.worker.id)), accessibilityIdentifier('worker-apparatus-save')]}
      onPress={() => { void controller.save(); }} /></Host>
  </View>;
}

// Master-only branch of V2 AdminWorkerSettingsScreen; no route is attached yet.
export function RezkaWorkerSettingsScreen({ session, snapshot, allowAssignments = false, navigation, footer }: RezkaWorkerSettingsProps) {
  const { controller, state, t, notice } = useRezkaWorkerSettings(session, snapshot, allowAssignments), sheet = useNativeSheet();
  useEffect(() => { if (!state.picker && sheet.isOpen()) sheet.close(); }, [sheet, state.picker]);
  const openPicker = (id: string) => {
    controller.openPicker(id);
    if (controller.getSnapshot().picker?.worker.id !== id) return;
    sheet.open(<AssignmentPicker controller={controller} />, { dismissible: true, onDismiss: () => controller.dismissPicker() });
  };
  const assignments = new Map((state.team?.assignments ?? []).map(item => [item.principal_ref, item]));
  return <View style={{ flex: 1, backgroundColor: PlatformColor('systemGroupedBackground') }}>
    <Stack.Screen options={{ title: t('worker.title'), ...(navigation ? { headerLeft: () =>
      <RoleHeaderButton {...navigation} tintColor={PlatformColor('label')} /> } : {}) }} />
    {state.notice ? <View accessibilityRole="alert" accessibilityLiveRegion="polite" style={{ padding: 12, backgroundColor: state.notice.tone === 'error' ? '#FCE8E6' : '#E6F4EA' }}>
      <Host matchContents={{ vertical: true }}><Text modifiers={[foregroundStyle(state.notice.tone === 'error' ? '#5F1412' : '#173A24')]}>{notice(state.notice)}</Text></Host></View> : null}
    <Host style={{ flex: 1 }}><List modifiers={[listStyle('insetGrouped'), refreshable(() => controller.load())]}>
      {state.phase === 'loading' ? <ProgressView /> : null}
      {state.phase === 'error' ? <Text>{t('worker.load_failed')}</Text> : null}
      {state.phase === 'ready' && !state.team?.workers.length ? <Text>{t('worker.empty')}</Text> : null}
      {state.phase === 'ready' ? state.team?.workers.map(worker => {
        const level = levels[worker.level] ?? 'three', expanded = state.expandedId === worker.id;
        const assigned = assignments.get(worker.id.trim())?.assigned_apparatus ?? [];
        const labels = apparatusLabels(assigned, state.team?.apparatus ?? []);
        const saving = state.savingIds.includes(worker.id.trim());
        return <Section key={worker.id}>
          <ListItem onPress={() => controller.expand(worker.id)} supportingText={[t(`worker.level.${level}`), worker.phone].filter(Boolean).join(' • ')}>{worker.name}</ListItem>
          {expanded ? <VStack alignment="leading" spacing={8}>
            <Text modifiers={[font({ textStyle: 'headline' })]}>{t('worker.worker_details', { name: worker.name })}</Text>
            <HStack><Text>{t('worker.name_label')}</Text><Text>{worker.name}</Text></HStack>
            <HStack><Text>{t('worker.level')}</Text><Text>{t(`worker.level.${level}`)}</Text></HStack>
            <HStack><Text>{t('worker.phone_label')}</Text><Text>{worker.phone || t('worker.not_entered')}</Text></HStack>
            <HStack><Text>{t('worker.id')}</Text><Text>{worker.id}</Text></HStack>
            {allowAssignments ? <Button modifiers={[disabled(saving || !state.team?.apparatus.length), accessibilityIdentifier(`worker-apparatus-picker-${worker.id}`)]}
              onPress={() => openPicker(worker.id)}><VStack alignment="leading"><Text>{t('scope.operator_title')}</Text>
                <Text>{labels.length ? labels.join(', ') : t('scope.none_selected')}</Text></VStack></Button> :
              <VStack alignment="leading"><Text>{t('scope.operator_title')}</Text><Text>{labels.length ? labels.join(', ') : t('scope.none_selected')}</Text></VStack>}
          </VStack> : null}
        </Section>;
      }) : null}
    </List></Host>
    {footer}
  </View>;
}
