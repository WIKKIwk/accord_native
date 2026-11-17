import { productionText } from '../shared/localization';
import { createQolipStorageBinding } from './qolipStorageBinding';
import { router, useFocusEffect, type Href } from 'expo-router';
import { useCallback, useEffect, useLayoutEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { Platform, Text, View } from 'react-native';
import { WorkerSheetButton } from '../components/WorkerSheetButton';
import { useWorkerColors } from '../components/useWorkerColors';
import { qolipDataRevision } from '../shared/qolipDataRevision';
import { useQolipRole } from './QolipRoleContext';
import { useQolipStorageRead } from './useQolipStorageRead';
import { useQolipStorageDialogs } from './useQolipStorageDialogs';
import { QolipStorageActions } from './qolipStorageActions';
import { qolipBlocksData } from './qolipReadOnlyBlocksApi';
import { qolipArchiveAction, qolipDeletePaddon, qolipPaddonAction, qolipPaddonCodeFromQr, qolipPaddonDetail,
  type QolipArchiveEntry, type QolipPaddon, type QolipStorageMold } from './qolipStorageApi';
import { qolipArchiveMolds, qolipArchivePaddonLocation, qolipArchivePaddonMoldCount, qolipPaddonStatusKey, qolipStorageErrorKey,
  groupQolipStorageProducts } from './qolipStoragePresentation';
import { useQolipPresentation } from './useQolipPresentation';
import { QolipStorageMoldPicker } from './QolipStorageMoldPicker';
import { StorageFilter, StorageList, StorageToggle } from './QolipStorageNative';
import type { StorageRow } from './qolipStorageViewProps';
import { useQolipFab } from './QolipFabContext';
import { QolipStorageDateDialog } from './QolipStorageDateDialog';
import { QolipStorageMoldDetails } from './QolipStorageMoldDetails';
import { useQolipStorageImages } from './useQolipStorageImages';
import { useQolipText } from './useQolipText';
import { useQolipPageHeader } from './QolipPageHeaderContext';

const prefix = () => Platform.OS === 'ios' ? '/ios-qolip' : '/android-qolip';
export function openQolipPaddon(code: string, add = false) {
  router.push({ pathname: `${prefix()}/paddon`, params: { code, addMolds: add ? 'true' : 'false' } } as Href);
}
export function openQolipArchiveEntry(entry: QolipArchiveEntry) {
  router.push({ pathname: `${prefix()}/archive-detail`, params: { entry: JSON.stringify({ ...entry, archived_by_name: entry.archived_by, restored_by_name: entry.restored_by }) } } as Href);
}

/** @v2 QolipStorageScreen */
export function QolipStorageScreenContent({ mode }: { mode: 'paddons' | 'archive' }) {
  const role = useQolipRole(), dialogs = useQolipStorageDialogs(), picker = useQolipPresentation(), menu = useQolipPresentation(), details = useQolipPresentation();
  const { locale } = useQolipText();
  const binding = useMemo(() => createQolipStorageBinding({ mounted: true, needsRefresh: false, dialogs, picker, locale, reload: async () => {}, removePaddon: (_code: string) => {} }), [role.session, role.boundary]); // eslint-disable-line react-hooks/exhaustive-deps
  useLayoutEffect(() => { binding.update({ dialogs, picker, locale }); });
  const openPaddon = (code: string, add = false) => { binding.update({ needsRefresh: true }); openQolipPaddon(code, add); };
  const actions = useMemo(() => new QolipStorageActions({ current: () => binding.read().mounted && role.isCurrent(), text: key => binding.read().dialogs.text(key),
    notice: role.notice, error: error => role.notice(binding.read().dialogs.text(qolipStorageErrorKey(error))),
    changed: () => qolipDataRevision.notifyLocationsChanged(), reload: () => binding.read().reload(),
    warehouses: async () => (await qolipBlocksData(role.session, role.isCurrent)).warehouses,
    createDialog: (warehouses, draft) => binding.read().dialogs.createDialog(warehouses, draft),
    confirm: (title, body, destructive) => binding.read().dialogs.confirm(title, body, destructive),
    selectMolds: (warehouse, paddonCode, scanInitially) => new Promise(resolve => {
      let result: readonly QolipStorageMold[] | null = null;
      binding.read().picker.open(<QolipStorageMoldPicker warehouse={warehouse} paddonCode={paddonCode} scanInitially={scanInitially}
        close={value => { result = value; binding.read().picker.close(); }} />, { presentation: 'page', onDismiss: () => resolve(result) });
    }),
    openPaddon: (code, add) => { binding.update({ needsRefresh: true }); openQolipPaddon(code, add); }, detail: code => qolipPaddonDetail(role.session, code, role.isCurrent),
    action: body => qolipPaddonAction(role.session, body, role.isCurrent), archive: body => qolipArchiveAction(role.session, body, role.isCurrent),
    delete: body => qolipDeletePaddon(role.session, body, role.isCurrent),
    notFound: () => productionText('worker.paddon.not_found', binding.read().locale),
    removePaddon: code => binding.read().removePaddon(code),
  }), [role, binding]);
  useSyncExternalStore(actions.subscribe, actions.getSnapshot, actions.getSnapshot);
  const saving = actions.saving;
  const state = useQolipStorageRead(role.session, role.boundary, mode === 'archive', saving);
  useLayoutEffect(() => { binding.update({ reload: () => state.controller.load(), removePaddon: code => state.controller.removePaddon(code) }); }, [binding, state.controller]);
  useEffect(() => { binding.update({ mounted: true }); return () => { binding.update({ mounted: false }); }; }, [binding]);
  useFocusEffect(useCallback(() => { if (binding.read().needsRefresh) { binding.update({ needsRefresh: false }); void state.controller.load(); } }, [state.controller, binding]));
  const colors = useWorkerColors(), { text: qolipText } = useQolipText(), t = dialogs.text, [datesOpen, setDatesOpen] = useState(false), [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set());
  useQolipPageHeader([{ id: 'refresh', label: t('refresh'), icon: 'refresh', symbol: 'arrow.clockwise', disabled: state.loading || saving }], () => { void state.controller.load(); });
  const openMold = (mold: QolipStorageMold) => details.open(<QolipStorageMoldDetails mold={mold} archivedSnapshot />, { dismissible: true, heightFraction: 0.86 });
  const openEntry = (entry: QolipArchiveEntry) => {
    if (!role.isCurrent()) return;
    if (entry.kind === 'paddon_mold') {
      const entries = qolipArchiveMolds([entry]); const mold = [...entries.keys()][0]; if (mold) openMold(mold);
    } else { binding.update({ needsRefresh: true }); openQolipArchiveEntry(entry); }
  };
  const paddonMenu = (paddon: QolipPaddon) => {
    if (saving || !role.isCurrent()) return;
    let action: 'add' | 'delete' | null = null;
    menu.open(<View style={{ padding: 16, gap: 12 }}>
      <WorkerSheetButton label={t('add')} onPress={() => { action = 'add'; menu.close(); }} />
      <WorkerSheetButton label={qolipText('action.delete')} onPress={() => { action = 'delete'; menu.close(); }} />
    </View>, { dismissible: true, compact: true, fitContent: true, onDismiss: () => {
      if (!role.isCurrent()) return;
      if (action === 'add') openPaddon(paddon.code, true);
      else if (action === 'delete') void actions.deletePaddon(paddon);
    } });
  };
  const scan = async () => {
    const raw = await dialogs.scanRaw(t('scan_paddon')); if (!raw || !role.isCurrent()) return;
    const code = qolipPaddonCodeFromQr(raw); if (code) openPaddon(code); else role.notice(t('invalid_paddon_qr'));
  };
  useQolipFab([
    ...(mode === 'paddons' ? [{ id: 'create', label: t('create'), icon: 'add' as const, symbol: 'plus' as const, disabled: saving }] : []),
    { id: 'scan', label: t('scan_paddon'), icon: 'qr_code_scanner', symbol: 'qrcode.viewfinder', disabled: saving },
    { id: 'archive', label: `${t('molds')}: ${t('archive_action')}`, icon: 'archive', symbol: 'archivebox', disabled: saving },
  ], id => { if (id === 'create') void actions.create(); else if (id === 'scan') void scan(); else void actions.archiveMolds(); });
  const archiveByMold = useMemo(() => mode === 'archive' && state.kind === 'qolip' ? qolipArchiveMolds(state.visibleArchive) : new Map(), [mode, state.kind, state.visibleArchive]);
  const groups = useMemo(() => groupQolipStorageProducts(archiveByMold.keys()), [archiveByMold]);
  const images = useQolipStorageImages(groups), rows: StorageRow[] = [];
  if (mode === 'archive' && state.kind === 'qolip') for (const group of groups) {
    rows.push({ id: group.key, title: group.unlinked ? t('unlinked_molds') : group.name || group.code, subtitle: group.code, imageOrderId: images[group.key],
      onPress: () => setExpanded(previous => { const next = new Set(previous); if (!next.delete(group.key)) next.add(group.key); return next; }) });
    if (expanded.has(group.key)) for (let index = 0; index < group.visibleMolds.length; index++) {
      const mold = group.visibleMolds[index], entry = archiveByMold.get(mold) as QolipArchiveEntry;
      rows.push({ id: `${group.key}:${index}:${entry.id}`, title: mold.code,
        subtitle: [mold.size > 0 ? mold.size : '', mold.color, t(entry.is_open ? 'archived' : 'returned')].filter(Boolean).join(' • '), onPress: () => openEntry(entry) });
    }
  } else if (mode === 'archive') for (let index = 0; index < state.visibleArchive.length; index++) {
    const entry = state.visibleArchive[index], count = entry.kind === 'paddon' ? qolipArchivePaddonMoldCount(entry) : null;
    rows.push({ id: `${entry.id}:${index}`, title: entry.code, subtitle: [count === null ? '' : `${t('molds')}: ${count}`,
      entry.warehouse, t(entry.is_open ? 'archived' : 'returned'), entry.kind === 'paddon' ? qolipArchivePaddonLocation(entry) : entry.parent_paddon_code].filter(Boolean).join(' • '), onPress: () => openEntry(entry) });
  } else for (const paddon of state.paddons) rows.push({ id: paddon.code, title: paddon.code,
    subtitle: `${t('molds')}: ${paddon.item_count}\n${[t(qolipPaddonStatusKey(paddon)), paddon.warehouse, paddon.location].filter(Boolean).join(' • ')}`,
    onPress: () => openPaddon(paddon.code), onLongPress: () => paddonMenu(paddon) });
  const refresh = useCallback(() => { void state.controller.load(); }, [state.controller]);
  useEffect(() => { const stop = role.boundary.subscribe(() => { if (!role.isCurrent()) picker.close(); }); return stop; }, [role, picker]);
  return <View style={{ flex: 1 }}><StorageList rows={rows} loading={state.loading || saving || state.warehouseLoading} refresh={refresh}
    title={t(mode)} {...(mode === 'archive' ? { onBack: () => router.dismissTo(prefix() as Href) } : { onMenu: role.onMenu })} onProfile={role.onProfile} dock={role.dock}
    query={state.query} onQuery={value => state.controller.setQuery(value)} searchHint={t(mode === 'archive' ? 'archive_search' : 'paddons_search')}
    onViewport={after => state.controller.viewportChanged(after)}
    header={<>{mode === 'paddons' ? <><Text style={{ color: colors.text, fontSize: 22, fontWeight: '700' }}>{t('paddon_summary')}</Text>
      <Text style={{ color: colors.text }}>{t('paddons_hint')}</Text><Text style={{ color: colors.text }}>{`${t('loaded_paddons')}: ${state.paddons.length} • ${t('molds')}: ${state.paddons.reduce((sum, item) => sum + item.item_count, 0)}`}</Text></> :
      <><StorageFilter label={`${t('warehouse')}: ${state.warehouse || t('all')}`} selected={!!state.warehouse} expanded={state.warehouseExpanded} value={state.warehouse}
        toggle={() => { void state.controller.toggleWarehouseFilter().then(error => { if (error) role.notice(t(qolipStorageErrorKey(error))); }); }}
        choose={value => { void state.controller.chooseWarehouse(value); }} options={[{ value: '', label: t('all') },
          ...[...new Set([...state.warehouses, ...(state.warehouse ? [state.warehouse] : [])])].map(value => ({ value, label: value }))]} />
        <StorageFilter label={`${t('kind')}: ${t(state.kind === 'all' ? 'all' : state.kind === 'paddon' ? 'paddons' : 'molds')}`} selected={state.kind !== 'all'} expanded={state.kindExpanded} value={state.kind}
          toggle={() => state.controller.toggleKindFilter()} choose={value => { void state.controller.chooseKind(value as 'all' | 'paddon' | 'qolip'); }}
          options={( ['all', 'paddon', 'qolip'] as const).map(kind => ({ value: kind, label: t(kind === 'all' ? 'all' : kind === 'paddon' ? 'paddons' : 'molds') }))} />
        <WorkerSheetButton label={state.dates ? `${state.dates.from.toLocaleDateString(locale)} – ${state.dates.to.toLocaleDateString(locale)}` : t('dates')} onPress={() => setDatesOpen(true)} />
        {state.dates && <WorkerSheetButton label={t('clear_date')} variant="text" onPress={() => { void state.controller.clearDates(); }} />}
        {(state.warehouse || state.kind !== 'all' || state.dates) && <WorkerSheetButton label={t('clear_filters')} onPress={() => { void state.controller.clearFilters(); }} />}
        <StorageToggle label={t('history')} subtitle={t(state.history ? 'all' : 'current')} disabled={saving} value={state.history} onChange={value => { void state.controller.setHistory(value); }} />
      </>}{actions.pendingArchiveCount > 0 && <><Text style={{ color: colors.text }}>{`${t('selected')}: ${actions.pendingArchiveCount}`}</Text><WorkerSheetButton label={t('cancel')} disabled={saving} onPress={() => actions.cancelArchive()} /></>}<Text style={{ color: colors.text, fontSize: 19, fontWeight: '600' }}>{`${t(mode === 'archive' ? 'archive' : 'paddon_list')} (${mode === 'archive' ? state.visibleArchive.length : state.paddons.length})`}</Text>{!!state.error && !state.moreFailure && <><Text style={{ color: colors.error }}>{t('failed')}</Text><WorkerSheetButton label={t('retry')} onPress={() => { void state.controller.load(); }} /></>}</>}
    footer={<>{!!state.error && state.moreFailure && <><Text style={{ color: colors.error }}>{t('failed')}</Text><WorkerSheetButton label={t('retry')} onPress={() => { void state.controller.load(true); }} /></>}
      {!state.loading && !state.error && !rows.length && (mode === 'paddons' || state.next === null) && <Text style={{ color: colors.text }}>{t('empty')}{mode === 'paddons' ? `\n${t('paddons_empty')}` : ''}</Text>}
      {mode === 'paddons' && state.next !== null && <WorkerSheetButton label={t('more')} disabled={state.loading} onPress={() => { void state.controller.load(true); }} />}
    </>} />
    {datesOpen && <QolipStorageDateDialog initial={state.dates} close={value => { setDatesOpen(false); if (value) void state.controller.chooseDates(value); }} />}
    {dialogs.overlays}
  </View>;
}
