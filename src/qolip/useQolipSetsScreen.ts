import * as Clipboard from 'expo-clipboard';
import { useEffect, useRef, useState } from 'react';
import { extensionText, adminText } from '../shared/localization';
import { qolipDataRevision } from '../shared/qolipDataRevision';
import { useQolipRole } from './QolipRoleContext';
import { useQolipText } from './useQolipText';
import { useQolipFab } from './QolipFabContext';
import { qolipFilterManagedSets } from './qolipSetsReadState';
import { qolipEditSet, qolipManagedSets, type QolipManagedSet } from './qolipSetsApi';
import { qolipPantonNumber } from './qolipCatalogEditorTypes';
import { useQolipCatalogEditors } from './useQolipCatalogEditors';
import { qolipErrorMessage } from './qolipErrorMessage';
import type { QolipCatalogProduct } from './qolipProductsState';

/** @v2 _QolipSetsScreenState */
export function useQolipSetsScreen() {
  const role = useQolipRole(), { text: t, locale } = useQolipText(), editor = useQolipCatalogEditors();
  const [entries, setEntries] = useState<QolipManagedSet[]>([]), [query, setQuery] = useState(''), [expanded, setExpanded] = useState<string | null>(null);
  const [loading, setLoading] = useState(true), [error, setError] = useState(false), [saving, setSaving] = useState(false), [rename, setRename] = useState<QolipManagedSet | null>(null);
  const [actionsEntry, setActionsEntry] = useState<QolipManagedSet | null>(null);
  const generation = useRef(0), mounted = useRef(true), savingLock = useRef(false);
  const current = () => mounted.current && role.isCurrent();
  const m = (key: string, values: Record<string, unknown> = {}) => extensionText('qolipManagementText', key, locale, values);
  const reload = async () => {
    if (!current()) return; const id = ++generation.current; setLoading(true); setError(false);
    try { const rows = await qolipManagedSets(role.session, () => current() && id === generation.current); if (current() && id === generation.current) setEntries(rows); }
    catch { if (current() && id === generation.current) setError(true); }
    finally { if (current() && id === generation.current) setLoading(false); }
  };
  useEffect(() => { mounted.current = true; void Promise.resolve().then(reload); return () => { mounted.current = false; generation.current++; }; }, [role.session, role.boundary]); // eslint-disable-line react-hooks/exhaustive-deps
  const run = async (callback: () => Promise<void>) => {
    if (!current() || savingLock.current) return; savingLock.current = true; setSaving(true);
    try { await callback(); } catch (error) { if (current()) role.notice(qolipErrorMessage(error, locale)); }
    finally { savingLock.current = false; if (current()) setSaving(false); }
  };
  const create = () => run(async () => {
    const created = await editor.openSet(); if (!current() || !created) return;
    setQuery(''); setExpanded(created.set.id); qolipDataRevision.notifyLocationsChanged(); role.notice(m('created', { code: created.set.id })); await reload();
  });
  useQolipFab([{ id: 'create', label: m('create'), icon: 'add', symbol: 'plus' }], () => { void create(); }, !saving);
  const add = (entry: QolipManagedSet) => run(async () => {
    const used = new Set(entry.set.members.map(member => qolipPantonNumber(member.color))), next = Array.from({ length: 100 }, (_, i) => i + 1).find(number => !used.has(number)) ?? null;
    const saved = await editor.openMold({ scope: `${entry.set.id}\n${m('set_scope')}`, initialSize: entry.set.members[0]?.size ?? 0, availablePantonNumber: next,
      onSave: draft => qolipEditSet(role.session, { current: entry, add: [draft] }, role.isCurrent) });
    if (!current()) return; if (saved) qolipDataRevision.notifyLocationsChanged(); await reload();
  });
  const remove = (entry: QolipManagedSet, mold: QolipCatalogProduct) => run(async () => {
    if (mold.is_in_use) return;
    const message = [m('delete_body', { code: mold.qolip_code }), ...(entry.set.members.length === 1 ? [m('delete_last')] : [])].join('\n\n');
    if (!await editor.confirm({ title: m('delete_title'), message, cancel: t('action.cancel'), confirm: t('action.delete'), dismissible: true }) || !current()) return;
    try { await qolipEditSet(role.session, { current: entry, remove: [mold.qolip_code] }, role.isCurrent); if (current()) qolipDataRevision.notifyLocationsChanged(); }
    catch (error) { if (current()) role.notice(qolipErrorMessage(error, locale)); }
    if (current()) await reload();
  });
  const closeRename = () => { setRename(null); savingLock.current = false; setSaving(false); };
  return { role, locale, t, m, editor, entries: qolipFilterManagedSets(entries, query), query, setQuery, expanded, loading, error, saving, rename, actionsEntry, setActionsEntry,
    openRename: () => { if (!actionsEntry || !current() || savingLock.current) return; const entry = actionsEntry; setActionsEntry(null); savingLock.current = true; setSaving(true); setRename(entry); }, closeRename,
    reload, add, remove, toggle: (entry: QolipManagedSet) => { if (!saving && current()) setExpanded(value => value === entry.set.id ? null : entry.set.id); },
    copy: async (code: string) => { if (!current()) return; await Clipboard.setStringAsync(code); if (current()) role.notice(adminText('detail.code_copied', locale)); },
    renamed: (saved: QolipManagedSet) => { if (!current()) return; closeRename(); setEntries(values => values.map(entry => entry.set.id === saved.set.id ? saved : entry)); role.notice(m('renamed')); },
  };
}
