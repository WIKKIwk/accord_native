import { useEffect, useMemo, useSyncExternalStore } from 'react';
import { captureSessionWitness, isSessionWitnessCurrent, registerSessionResetHook, subscribeSessionWitness, type Session } from '../auth';
import { emptyProductionOrderNote, latestProductionOrderNote, MAX_PRODUCTION_NOTE_CHARS, type ProductionOrderNote } from '../shared/productionOrderNote';
import { savePreparationProductionNote } from './preparationProductionNoteApi';
import { PreparationProductionNoteEditor } from './preparationProductionNoteEditor';
import { WorkerControlException } from '../workerControlsApi';

export function usePreparationProductionNote(session: Session, orderId: string, incoming: ProductionOrderNote | undefined, refresh?: () => void) {
  const editor = useMemo(() => {
    const witness = captureSessionWitness(session);
    return new PreparationProductionNoteEditor(orderId, () => isSessionWitnessCurrent(witness),
      (text, revision) => savePreparationProductionNote(session, orderId, text, revision));
  }, [session, orderId]);
  const state = useSyncExternalStore(editor.subscribe, editor.snapshot, editor.snapshot);
  useEffect(() => {
    editor.setFailureHandler(error => { if (error instanceof WorkerControlException && error.statusCode === 409) refresh?.(); });
    return () => { editor.setFailureHandler(); };
  }, [editor, refresh]);
  useEffect(() => {
    const unregister = registerSessionResetHook(async () => { editor.invalidate(); });
    const unsubscribe = subscribeSessionWitness(() => { editor.invalidate(); });
    return () => { unregister(); unsubscribe(); };
  }, [editor]);
  const note = latestProductionOrderNote(incoming ?? emptyProductionOrderNote(orderId), state.confirmed);
  return { state, note, open: () => editor.open(note), change: editor.change, cancel: editor.cancel, save: editor.save,
    canSave: editor.canSave, count: Array.from(state.draft.trim()).length, limit: MAX_PRODUCTION_NOTE_CHARS };
}
