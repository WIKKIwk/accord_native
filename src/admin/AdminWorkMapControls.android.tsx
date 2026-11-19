import { padding } from '@expo/ui/jetpack-compose/modifiers';
import { useIsFocused } from 'expo-router';
import { useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { appPreferences } from '../appPreferences';
import type { AdminApparatus } from '../apparatusApi';
import { BrigaderSequenceList } from '../brigader/BrigaderSequenceList';
import { BaseHost } from '../components/BaseHost.android';
import { useBaseTheme } from '../components/useBaseTheme';
import { WorkerQueueCard } from '../components/WorkerQueueCard.android';
import { WorkerSheetButton } from '../components/WorkerSheetButton';
import { useNativeSheet } from '../nativeSheet';
import { DropdownFilter } from '../shared/filters/DropdownFilter.android';
import { adminText, localizedGetter, productionText } from '../shared/localization';
import { AdminApparatusFilterOrder, applyApparatusFilterOrder, reorderApparatusFilter } from './adminApparatusFilterOrderStore';
import { AdminText } from './AdminTypography.android';
import { dartTrim } from './dartJsonString';
import type { AdminWorkMapControlsProps } from './adminWorkMapControlsTypes';

export function AdminWorkMapApparatusFilter({ catalog, selected, apparatusLabel, unselectedLabel, countText, onApparatus, onEdit }: AdminWorkMapControlsProps & {
  onEdit?: (id: string) => void;
}) {
  const { colors } = useBaseTheme();
  const options = useMemo(() => catalog.map(item => ({ value: item.id, label: dartTrim(item.name),
    ...(onEdit ? { onLongPress: () => onEdit(item.id) } : {}) })), [catalog, onEdit]);
  return <View style={{ paddingTop: 4 }}>
    <DropdownFilter label={apparatusLabel} selectedLabel={(selected && dartTrim(selected.name)) || unselectedLabel}
      options={options} enabled={options.length > 0} backgroundColor={colors.surface} onChange={onApparatus} />
    {!!countText && <BaseHost matchContents={{ vertical: true }} style={{ width: '100%' }}>
      <AdminText color={colors.onSurfaceVariant} style={{ typography: 'bodySmall' }} modifiers={[padding(12, 8, 12, 10)]}>{countText}</AdminText>
    </BaseHost>}
  </View>;
}

function ApparatusOrderEditor({ catalog, current, locale, onCancel, onSave }: {
  catalog: readonly AdminApparatus[]; current: () => boolean; locale: string;
  onCancel: () => void; onSave: (ids: readonly string[]) => void;
}) {
  const [draft, setDraft] = useState(catalog), focused = useIsFocused(), { colors } = useBaseTheme();
  const interactive = () => focused && current();
  return <View style={styles.editor}>
    <Text style={[styles.title, { color: colors.onSurface }]}>{productionText('admin.apparatus_filter_order.edit', locale)}</Text>
    <Text style={{ color: colors.onSurfaceVariant }}>{productionText('admin.apparatus_filter_order.drag_hint', locale)}</Text>
    <BrigaderSequenceList rows={draft} rowKey={item => dartTrim(item.id)} activeCount={draft.length} enabled={focused}
      current={interactive} onReorder={(from, to) => setDraft(previous => reorderApparatusFilter(previous, from, to))}
      render={(item, index, handle) => <WorkerQueueCard first={index === 0} last={index === draft.length - 1} backgroundColor={colors.surfaceContainerLow}>
        <Text style={{ color: colors.onSurfaceVariant }}>{index + 1}</Text>
        <Text style={[styles.name, { color: colors.onSurface }]}>{dartTrim(item.name)}</Text>{handle}
      </WorkerQueueCard>} />
    <View style={styles.actions}>
      <View style={styles.action}><WorkerSheetButton variant="text" label={adminText('action.cancel', locale)} onPress={onCancel} /></View>
      <View style={styles.action}><WorkerSheetButton variant="filled" disabled={!focused} label={localizedGetter('save', locale)}
        onPress={() => { if (interactive()) onSave(draft.map(item => dartTrim(item.id))); }} /></View>
    </View>
  </View>;
}

export function AdminWorkMapSequenceFilter({ locale, profileRef, isCurrent, onError, ...props }: AdminWorkMapControlsProps & {
  locale: string; profileRef: string; isCurrent: () => boolean; onError: (message: string) => void;
}) {
  const sheet = useNativeSheet(), focused = useIsFocused(), { colors } = useBaseTheme();
  const owner = useMemo(() => new AdminApparatusFilterOrder(profileRef, appPreferences, isCurrent), [profileRef, isCurrent]);
  const state = useSyncExternalStore(owner.subscribe, owner.getSnapshot, owner.getSnapshot), latest = useRef(props.catalog);
  useEffect(() => { void owner.start(); return () => owner.stop(); }, [owner]);
  useLayoutEffect(() => { latest.current = props.catalog; }, [props.catalog]);
  const ordered = useMemo(() => applyApparatusFilterOrder(props.catalog, state.savedIds), [props.catalog, state.savedIds]);

  const edit = (id: string) => {
    if (!focused || sheet.isOpen()) return;
    const catalog = applyApparatusFilterOrder(latest.current, owner.getSnapshot().savedIds);
    const selected = catalog.find(item => item.id === id), ticket = selected ? owner.begin() : null;
    if (!ticket || !selected) return;
    const current = () => owner.owns(ticket);
    const reportFailure = () => { if (isCurrent()) onError(productionText('admin.apparatus_filter_order.save_failed', locale)); };
    const failToOpen = () => {
      if (current()) reportFailure();
      owner.cancel(ticket);
    };
    const save = (ids: readonly string[] | null) => { void owner.save(ticket, ids, latest.current).catch(reportFailure); };
    const openEditor = () => {
      const rows = applyApparatusFilterOrder(latest.current, owner.getSnapshot().savedIds);
      let result: readonly string[] | undefined;
      sheet.open(<ApparatusOrderEditor catalog={rows} current={current} locale={locale} onCancel={sheet.close}
        onSave={ids => { if (result === undefined && current()) { result = ids; sheet.close(); } }} />,
      { heightFraction: .85, dismissible: true, onDismiss: () => { if (result === undefined) owner.cancel(ticket); else save(result); } });
    };
    let choice: 'edit' | 'reset' | undefined;
    const canEdit = catalog.length > 1, canReset = owner.getSnapshot().savedIds.length > 0;
    const choose = (value: 'edit' | 'reset') => {
      if (choice === undefined && current()) { choice = value; sheet.close(); }
    };
    try {
      sheet.open(<View style={styles.menu}>
        <Text style={[styles.title, { color: colors.onSurface }]}>{dartTrim(selected.name)}</Text>
        <WorkerSheetButton variant="text" disabled={!canEdit} label={productionText('admin.apparatus_filter_order.edit', locale)} onPress={() => { if (canEdit) choose('edit'); }} />
        <WorkerSheetButton variant="text" disabled={!canReset} label={productionText('admin.apparatus_filter_order.reset', locale)} onPress={() => { if (canReset) choose('reset'); }} />
      </View>, { compact: true, dismissible: true, onDismiss: () => {
        if (!choice || !current()) { owner.cancel(ticket); return; }
        if (choice === 'reset') save(null);
        else try { openEditor(); } catch { failToOpen(); }
      } });
    } catch { failToOpen(); }
  };
  return <AdminWorkMapApparatusFilter {...props} catalog={ordered} onEdit={state.ready && !state.editing ? edit : undefined} />;
}

const styles = StyleSheet.create({
  editor: { flex: 1, padding: 16, gap: 8 }, menu: { paddingHorizontal: 24, paddingVertical: 12, gap: 4 },
  title: { fontSize: 18, fontWeight: '600' }, actions: { flexDirection: 'row', gap: 12 },
  action: { flex: 1 }, name: { flex: 1, marginStart: 8 },
});
