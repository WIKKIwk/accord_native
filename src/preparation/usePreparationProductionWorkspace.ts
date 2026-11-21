import { useCallback, useEffect, useMemo, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { AppState } from 'react-native';
import { registerSessionResetHook, type Session } from '../auth';
import { createPreparationProductionWorkspaceJournal, productionViews, type ProductionRow, type ProductionView } from './preparationJournalFactory';
import type { JournalState, PreparationJournal } from './preparationJournal';
import { usePreparationOutputNotes } from './usePreparationOutputNotes';

export const productionStatuses = [
  { value: 'all', label: 'Barchasi' },
  { value: 'active', label: 'Davom etmoqda' },
  { value: 'completed', label: 'Yakunlangan' },
] as const;
export const productionSearchPlaceholder = 'Xomashyo, buyurtma raqami yoki QR';

export function usePreparationJournal<T, S>(create: (changed: (state: JournalState<T, S>) => void) => PreparationJournal<T, S>) {
  const [snapshot, setSnapshot] = useState<{ journal: PreparationJournal<T, S>; state: JournalState<T, S> }>();
  const group = useMemo(() => {
    const journal = create(state => setSnapshot({ journal, state }));
    let mounts = 0;
    return { journal, mount() {
      mounts++;
      journal.start();
      return () => { mounts--; queueMicrotask(() => { if (!mounts) journal.dispose(); }); };
    } };
  }, [create]);
  const { journal } = group;
  useEffect(() => group.mount(), [group]);
  useEffect(() => registerSessionResetHook(async () => { journal.invalidate(); }), [journal]);
  useFocusEffect(useCallback(() => {
    journal.setVisible(true);
    if (!journal.state.loading) void journal.load({ silent: true });
    return () => journal.setVisible(false);
  }, [journal]));
  useEffect(() => {
    journal.setResumed(AppState.currentState === 'active');
    const subscription = AppState.addEventListener('change', state => journal.setResumed(state === 'active'));
    return () => subscription.remove();
  }, [journal]);
  return { state: snapshot?.journal === journal ? snapshot.state : journal.state, journal };
}

export function usePreparationProductionWorkspace(session: Session) {
  const [view, setView] = useState<ProductionView>('batches');
  const [query, setQuery] = useState(''), [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  useEffect(() => {
    const timer = setTimeout(() => setSearch(query.trim()), 350);
    return () => clearTimeout(timer);
  }, [query]);
  const create = useCallback((changed: (state: JournalState<ProductionRow>) => void) =>
    createPreparationProductionWorkspaceJournal(session, view, () => ({ query: search, status }), changed), [session, view, search, status]);
  const { state, journal } = usePreparationJournal(create);
  const notes = usePreparationOutputNotes(session, () => { void journal.load(); });
  const accountChanged = state.error === 'Akkaunt o‘zgargan. Sahifani qayta oching';

  return {
    view, query, status, state, journal, notes, accountChanged,
    selectView: (id: string) => {
      const target = productionViews.find(item => item.id === id);
      if (!target || target.id === view || accountChanged) return;
      notes.clearSelection();
      setSearch(query.trim());
      setView(target.id);
    },
    changeQuery: (value: string) => { if (!accountChanged) { notes.clearSelection(); setQuery(value); } },
    changeStatus: (value: string) => {
      if (accountChanged || value === status) return;
      notes.clearSelection();
      setSearch(query.trim());
      setStatus(value);
    },
    openRollNotes: () => notes.openSelection(state.items.flatMap(row => row.kind === 'roll' ? [row.roll] : [])),
    loadMore: () => { if (!state.loading && state.has_more && !state.error) void journal.load({ append: true }); },
  };
}
