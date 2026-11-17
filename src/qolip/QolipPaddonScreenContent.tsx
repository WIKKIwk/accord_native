import { createQolipStorageBinding } from './qolipStorageBinding';
import { useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { Text, View } from 'react-native';
import { WorkerSheetButton } from '../components/WorkerSheetButton';
import { useWorkerColors } from '../components/useWorkerColors';
import { productionText } from '../shared/localization';
import { qolipDataRevision } from '../shared/qolipDataRevision';
import { QolipPaddonActions } from './qolipStorageActions';
import { qolipPaddonAction, qolipPaddonDetail, type QolipStorageMold } from './qolipStorageApi';
import { groupQolipStorageProducts, qolipPaddonStatusKey, qolipStorageErrorKey } from './qolipStoragePresentation';
import { useQolipRole } from './QolipRoleContext';
import { useQolipStorageDialogs } from './useQolipStorageDialogs';
import { useQolipStorageImages } from './useQolipStorageImages';
import { useQolipPresentation } from './useQolipPresentation';
import { useQolipPrinting } from './useQolipPrinting';
import { useQolipText } from './useQolipText';
import { useQolipFab } from './QolipFabContext';
import { StorageList } from './QolipStorageNative';
import { QolipStorageMoldPicker } from './QolipStorageMoldPicker';
import { QolipStorageMoldDetails } from './QolipStorageMoldDetails';
import type { StorageRow } from './qolipStorageViewProps';
import { QolipStorageQrDialog } from './QolipStorageQrDialog';
import { useQolipPageHeader } from './QolipPageHeaderContext';

/** @v2 QolipPaddonScreen */
export function QolipPaddonScreenContent({ code, addMolds = false }: { code: string; addMolds?: boolean }) {
  const role = useQolipRole(), dialogs = useQolipStorageDialogs();
  const binding = useMemo(() => createQolipStorageBinding({ mounted: true, dialogs }), [role.session, role.boundary]); // eslint-disable-line react-hooks/exhaustive-deps
  useLayoutEffect(() => { binding.update({ dialogs }); });
  const owner = useMemo(() => new QolipPaddonActions(code, { current: () => binding.read().mounted && role.isCurrent(), text: key => binding.read().dialogs.text(key),
    notice: role.notice, error: error => role.notice(binding.read().dialogs.text(qolipStorageErrorKey(error))),
    changed: () => qolipDataRevision.notifyLocationsChanged(), confirm: (title, body) => binding.read().dialogs.confirm(title, body),
    detail: code => qolipPaddonDetail(role.session, code, role.isCurrent), action: body => qolipPaddonAction(role.session, body, role.isCurrent),
  }), [code, role, binding]);
  useSyncExternalStore(owner.subscribe, owner.getSnapshot, owner.getSnapshot);
  useEffect(() => { binding.update({ mounted: true }); void owner.load(); return () => { binding.update({ mounted: false }); owner.dispose(); }; }, [owner, binding]);
  const picker = useQolipPresentation(), detailSheet = useQolipPresentation(), printer = useQolipPrinting(), colors = useWorkerColors(), { locale } = useQolipText();
  const [printing, setPrinting] = useState(false), [qrOpen, setQrOpen] = useState(false), [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set());
  const openAddPending = useRef(addMolds), detail = owner.detail, enabled = !owner.saving && !owner.loading && !!detail;
  const t = dialogs.text, groups = useMemo(() => groupQolipStorageProducts(detail?.items ?? []), [detail]), images = useQolipStorageImages(groups);
  useQolipPageHeader([{ id: 'qr', label: t('scan_paddon'), icon: 'qr_code_2', symbol: 'qrcode' },
    { id: 'refresh', label: t('refresh'), icon: 'refresh', symbol: 'arrow.clockwise', disabled: owner.loading || owner.saving }],
  id => { if (id === 'qr') setQrOpen(true); else void owner.load(); }, true);
  const add = async (scan = false) => {
    if (!enabled || !owner.detail?.paddon.editable || !role.isCurrent()) return;
    const result = await new Promise<readonly QolipStorageMold[] | null>(resolve => {
      let selected: readonly QolipStorageMold[] | null = null;
      picker.open(<QolipStorageMoldPicker warehouse={owner.detail!.paddon.warehouse} paddonCode={code} scanInitially={scan}
        close={value => { selected = value; picker.close(); }} />, { presentation: 'page', onDismiss: () => resolve(selected) });
    });
    if (result?.length && role.isCurrent()) await owner.act('add', result.map(mold => mold.code));
  };
  useEffect(() => {
    if (!owner.loading && owner.detail && openAddPending.current) {
      openAddPending.current = false;
      if (owner.detail.paddon.editable) requestAnimationFrame(() => { void add(); });
      else role.notice(t('locked_error'));
    }
  });
  const inspect = async () => { if (!enabled || !detail) return; const codes = await dialogs.inspect(detail.items.map(mold => mold.code)); if (codes && role.isCurrent()) await owner.act('inspect', codes); };
  useQolipFab([
    ...(detail?.paddon.editable ? [{ id: 'scan', label: t('scan_add'), icon: 'qr_code_scanner' as const, symbol: 'qrcode.viewfinder' as const, disabled: !enabled },
      { id: 'add', label: t('add'), icon: 'playlist_add' as const, symbol: 'text.badge.plus' as const, disabled: !enabled }] : []),
    { id: 'inspect', label: t('inspect'), icon: 'fact_check', symbol: 'checklist', disabled: !enabled },
  ], id => { if (id === 'inspect') void inspect(); else void add(id === 'scan'); });
  const print = async () => {
    if (printing || !enabled || !role.isCurrent()) return;
    setPrinting(true);
    try { if (await printer.printPaddon(code) && role.isCurrent()) role.notice(productionText('worker.paddon.printed', locale, { qr: code })); }
    catch { if (role.isCurrent()) role.notice(productionText('worker.paddon.print_failed', locale)); }
    finally { if (role.isCurrent()) setPrinting(false); }
  };
  const rows: StorageRow[] = [];
  for (const group of groups) {
    rows.push({ id: group.key, title: group.unlinked ? t('unlinked_molds') : group.name || group.code, subtitle: group.code, imageOrderId: images[group.key],
      onPress: () => setExpanded(previous => { const next = new Set(previous); if (!next.delete(group.key)) next.add(group.key); return next; }) });
    if (expanded.has(group.key)) for (const mold of new Map(group.visibleMolds.map(mold => [mold.code.trim().toLowerCase(), mold])).values()) rows.push({
      id: `${group.key}:${mold.code}`, title: mold.code, subtitle: [group.unlinked ? mold.name : '', mold.size > 0 ? mold.size : '', mold.color].filter(Boolean).join(' • '),
      onPress: () => detailSheet.open(<QolipStorageMoldDetails mold={mold} />, { dismissible: true, heightFraction: 0.86 }),
      ...(detail?.paddon.editable ? { disabled: !enabled, trailing: { label: t('remove'), onPress: () => { void owner.act('remove', [mold.code]); } } } : {}),
    });
  }
  return <View style={{ flex: 1 }}><StorageList rows={rows} loading={owner.loading || owner.saving} refresh={() => { void owner.load(); }}
    header={detail ? <><Text style={{ color: colors.text, fontSize: 24, fontWeight: '700' }}>{detail.paddon.code}</Text>
      <WorkerSheetButton label={productionText('worker.paddon.print.short', locale)} disabled={!enabled || printing} variant="filled" onPress={() => { void print(); }} />
      <Text style={{ color: colors.text }}>{detail.paddon.warehouse}</Text>{!!detail.paddon.location && <Text style={{ color: colors.text }}>{detail.paddon.location}</Text>}
      {!!detail.paddon.note && <Text style={{ color: colors.text }}>{detail.paddon.note}</Text>}
      <Text style={{ color: colors.text }}>{`${t(qolipPaddonStatusKey(detail.paddon))} • ${t('molds')}: ${detail.items.length}`}</Text>
      {!detail.paddon.archived && <WorkerSheetButton label={t(detail.paddon.locked ? 'unlock' : 'lock')} disabled={!enabled} onPress={() => { void owner.act(detail.paddon.locked ? 'unlock' : 'lock'); }} />}
      <WorkerSheetButton label={t(detail.paddon.archived ? 'restore' : 'archive_action')} disabled={!enabled} onPress={() => { void owner.act(detail.paddon.archived ? 'restore' : 'archive'); }} />
      {!!owner.error && <WorkerSheetButton label={t('failed')} onPress={() => { void owner.load(); }} />}
      {owner.pendingAction && <><Text style={{ color: colors.error }}>{t('failed')}</Text>{owner.pendingCodes.length > 0 && <Text style={{ color: colors.text }}>{owner.pendingCodes.join(', ')}</Text>}
        <WorkerSheetButton label={t('retry')} disabled={!enabled} onPress={() => { void owner.act(owner.pendingAction!, owner.pendingCodes); }} /></>}
      <Text style={{ color: colors.text, fontSize: 19, fontWeight: '600' }}>{t('contents')}</Text>
    </> : undefined}
    footer={<>{!!owner.error && !detail && <WorkerSheetButton label={t('failed')} onPress={() => { void owner.load(); }} />}
      {detail && !detail.items.length && <Text style={{ color: colors.text }}>{t('empty')}</Text>}
      {owner.inspection && (['found', 'missing', 'unexpected'] as const).map(key => <Text key={key} style={{ color: colors.text }}>{`${t(key)}: ${(Array.isArray(owner.inspection![key]) ? owner.inspection![key] as unknown[] : []).join(', ')}`}</Text>)}
    </>} />{qrOpen && <QolipStorageQrDialog code={code} paddon close={() => setQrOpen(false)} />}{dialogs.overlays}</View>;
}
