import { createQolipStorageBinding } from './qolipStorageBinding';
import { useEffect, useLayoutEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { Text, View } from 'react-native';
import { WorkerSheetButton } from '../components/WorkerSheetButton';
import { useWorkerColors } from '../components/useWorkerColors';
import { qolipDataRevision } from '../shared/qolipDataRevision';
import { QolipArchiveRestore } from './qolipStorageActions';
import { qolipArchiveAction, qolipPaddonAction, qolipPaddonDetail, qolipStorageMoldFromJson, type QolipArchiveEntry } from './qolipStorageApi';
import { groupQolipStorageProducts, qolipStorageErrorKey } from './qolipStoragePresentation';
import { useQolipRole } from './QolipRoleContext';
import { useQolipStorageDialogs } from './useQolipStorageDialogs';
import { useQolipPresentation } from './useQolipPresentation';
import { QolipStorageMoldDetails } from './QolipStorageMoldDetails';
import { StorageList } from './QolipStorageNative';
import { openQolipPaddon } from './QolipStorageScreenContent';
import { qolipReworkDate } from './qolipMileageFormatting';
import { QolipStorageQrDialog } from './QolipStorageQrDialog';
import { useQolipPageHeader } from './QolipPageHeaderContext';
import { QolipArchivePaddonQr } from './QolipArchivePaddonQr';
import { useQolipStorageImages } from './useQolipStorageImages';
import type { StorageRow } from './qolipStorageViewProps';

/** @v2 QolipArchiveDetailScreen */
export function QolipArchiveDetailScreenContent({ entry }: { entry: QolipArchiveEntry }) {
  const role = useQolipRole(), dialogs = useQolipStorageDialogs();
  const binding = useMemo(() => createQolipStorageBinding({ mounted: true, dialogs }), [role.session, role.boundary]); // eslint-disable-line react-hooks/exhaustive-deps
  useLayoutEffect(() => { binding.update({ dialogs }); });
  useEffect(() => { binding.update({ mounted: true }); return () => { binding.update({ mounted: false }); }; }, [binding]);
  const owner = useMemo(() => new QolipArchiveRestore(entry, { current: () => binding.read().mounted && role.isCurrent(), text: key => binding.read().dialogs.text(key),
    notice: role.notice, error: error => role.notice(binding.read().dialogs.text(qolipStorageErrorKey(error))), changed: () => qolipDataRevision.notifyLocationsChanged(),
    confirm: (title, body) => binding.read().dialogs.confirm(title, body), detail: code => qolipPaddonDetail(role.session, code, role.isCurrent),
    action: body => qolipPaddonAction(role.session, body, role.isCurrent), archive: body => qolipArchiveAction(role.session, body, role.isCurrent),
  }), [entry, role, binding]);
  useSyncExternalStore(owner.subscribe, owner.getSnapshot, owner.getSnapshot);
  const colors = useWorkerColors(), details = useQolipPresentation(), t = dialogs.text;
  const [qrOpen, setQrOpen] = useState(false), [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set());
  const rawItems = Array.isArray(entry.snapshot.items) ? entry.snapshot.items : entry.snapshot.mold && typeof entry.snapshot.mold === 'object'
    ? [entry.snapshot.mold] : Object.hasOwn(entry.snapshot, 'qolip_code') ? [entry.snapshot] : [];
  const molds = rawItems.filter(value => value && typeof value === 'object' && !Array.isArray(value) &&
    (entry.kind !== 'paddon' || (typeof (value as Record<string, unknown>).qolip_code === 'string' && !!((value as Record<string, unknown>).qolip_code as string).trim()))).map(qolipStorageMoldFromJson);
  const groups = groupQolipStorageProducts(entry.kind === 'paddon' ? molds : []), images = useQolipStorageImages(groups), rows: StorageRow[] = [];
  if (entry.kind === 'paddon') for (const group of groups) {
    rows.push({ id: group.key, title: group.unlinked ? t('unlinked_molds') : group.name || group.code, subtitle: group.code, imageOrderId: images[group.key],
      onPress: () => setExpanded(previous => { const next = new Set(previous); if (!next.delete(group.key)) next.add(group.key); return next; }) });
    if (expanded.has(group.key)) group.visibleMolds.forEach((mold, index) => rows.push({ id: `${group.key}:${index}:${mold.code}`, title: mold.code,
      subtitle: [group.unlinked ? mold.name : '', mold.size > 0 ? mold.size : '', mold.color].filter(Boolean).join(' • '),
      onPress: () => details.open(<QolipStorageMoldDetails mold={mold} archivedSnapshot />, { dismissible: true, heightFraction: 0.86 }) }));
  } else molds.forEach((mold, index) => rows.push({ id: `${index}:${mold.code}`, title: mold.code,
    subtitle: `${mold.product_names}\n${[mold.size > 0 ? mold.size : '', mold.color].filter(Boolean).join(' • ')}`,
    onPress: () => details.open(<QolipStorageMoldDetails mold={mold} archivedSnapshot />, { dismissible: true, heightFraction: 0.86 }) }));
  useQolipPageHeader([{ id: 'qr', label: t('scan_paddon'), icon: 'qr_code_2', symbol: 'qrcode', disabled: owner.saving }], () => {
    if (entry.kind === 'paddon') details.open(<QolipArchivePaddonQr entry={entry} count={molds.length} close={details.close} />, { dismissible: true, heightFraction: 0.86 });
    else setQrOpen(true);
  }, true);
  const paddon = entry.snapshot.paddon && typeof entry.snapshot.paddon === 'object' ? entry.snapshot.paddon as Record<string, unknown> : null;
  const archived = entry.is_open && !owner.restored;
  return <View style={{ flex: 1 }}><StorageList rows={rows}
    loading={owner.saving} header={<><Text style={{ color: colors.text, fontSize: 24, fontWeight: '700' }}>{entry.code}</Text>
      <Text style={{ color: colors.text }}>{t(archived ? 'archived' : 'returned')}</Text><Text style={{ color: colors.text }}>{entry.warehouse}</Text>
      {entry.kind === 'paddon' && <Text style={{ color: colors.text }}>{`${t('molds')}: ${molds.length}`}</Text>}
      {typeof paddon?.location === 'string' && !!paddon.location && <Text style={{ color: colors.text }}>{paddon.location}</Text>}
      <Text style={{ color: colors.text }}>{`${t('archived_by')}: ${entry.archived_by}\n${qolipReworkDate(entry.archived_at)}`}</Text>
      {entry.restored_at !== null && <Text style={{ color: colors.text }}>{`${t('restored_by')}: ${entry.restored_by}\n${qolipReworkDate(entry.restored_at)}`}</Text>}
      {!!entry.note && <Text style={{ color: colors.text }}>{entry.note}</Text>}
      {archived && entry.kind !== 'paddon_mold' && <WorkerSheetButton label={t('restore')} disabled={owner.saving} variant="filled" onPress={() => { void owner.restore(); }} />}
      {entry.kind === 'paddon' && <WorkerSheetButton label={t('current_detail')} disabled={owner.saving} onPress={() => openQolipPaddon(entry.code)} />}
      <Text style={{ color: colors.text, fontSize: 19, fontWeight: '600' }}>{t('snapshot')}</Text>
      {!molds.length && <Text style={{ color: colors.text }}>{t('empty')}</Text>}
    </>} />{qrOpen && <QolipStorageQrDialog code={entry.code} paddon={entry.kind === 'paddon'} close={() => setQrOpen(false)} />}{dialogs.overlays}</View>;
}
