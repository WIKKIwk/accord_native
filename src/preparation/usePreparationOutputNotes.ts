import { useEffect, useMemo, useRef, useState } from 'react';
import { captureSessionWitness, isSessionWitnessCurrent, subscribeSessionWitness, type Session } from '../auth';
import type { PreparationOutputNote } from '../shared/preparationOutputNote';
import { MAX_PRODUCTION_NOTE_CHARS, productionNoteText } from '../shared/productionOrderNote';
import { WorkerControlException } from '../workerControlsApi';
import { MAX_OUTPUT_NOTE_ROLLS, savePreparationOutputNotes, type OutputNoteScope, type OutputNoteTarget } from './preparationOutputNoteApi';
import type { ProductionRoll } from './preparationJournalFactory';

type Draft = { scope: OutputNoteScope; targets: readonly OutputNoteTarget[]; text: string; edited: boolean; error: string | null };
type Notes = ReadonlyMap<string, PreparationOutputNote>;
const noteKey = (scope: OutputNoteScope, id: string) => `${scope}:${id}`;

export type PreparationNoteDialogEditor = {
  state: { original: unknown; draft: string; saving: boolean; error: string | null };
  canSave: boolean;
  count: number;
  limit: number;
  save(): void | Promise<void>;
  cancel(): void;
  change(text: string): void;
};

export function usePreparationOutputNotes(session: Session, refresh: () => void) {
  const witness = useMemo(() => captureSessionWitness(session), [session]);
  const active = useRef(false), command = useRef<Draft | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmed, setConfirmed] = useState<Notes>(() => new Map());
  const [selected, setSelected] = useState<ReadonlyMap<string, ProductionRoll>>(() => new Map());
  const clearSelection = () => setSelected(new Map());
  const isCurrent = () => active.current && isSessionWitnessCurrent(witness);

  useEffect(() => {
    active.current = true;
    const unsubscribe = subscribeSessionWitness(() => {
      command.current = null;
      setDraft(null);
      setSaving(false);
      setConfirmed(new Map());
      setSelected(new Map());
    });
    return () => { active.current = false; unsubscribe(); };
  }, [witness]);

  function latest(scope: OutputNoteScope, id: string, incoming: PreparationOutputNote | null) {
    const saved = confirmed.get(noteKey(scope, id));
    return saved && saved.revision > (incoming?.revision ?? 0) ? saved : incoming;
  }

  function open(scope: OutputNoteScope, rows: readonly OutputNoteTarget[]) {
    if (!isCurrent() || command.current || !rows.length) return;
    const targets = rows.map(row => ({ ...row, note: latest(scope, row.id, row.note) }));
    const text = targets[0].note?.text ?? '';
    setDraft({ scope, targets, text: targets.every(row => (row.note?.text ?? '') === text) ? text : '', edited: false, error: null });
  }

  function toggle(roll: ProductionRoll) {
    if (!isCurrent() || !roll.receipt_name || command.current) return;
    setSelected(previous => {
      const next = new Map(previous);
      if (next.delete(roll.receipt_name)) return next;
      if (next.size >= MAX_OUTPUT_NOTE_ROLLS) return previous;
      return next.set(roll.receipt_name, roll);
    });
  }

  function openSelection(visibleRolls: readonly ProductionRoll[]) {
    const visible = new Map(visibleRolls.map(roll => [roll.receipt_name, roll]));
    open('rolls', Array.from(selected, ([id, original]) => ({ id, note: (visible.get(id) ?? original).roll_note })));
  }

  const normalized = (draft?.text ?? '').trim();
  const count = Array.from(normalized).length;
  const canSave = !!draft?.edited && !saving && !normalized.includes('\0') && count <= MAX_PRODUCTION_NOTE_CHARS &&
    draft.targets.some(target => (target.note?.text ?? '') !== normalized);

  async function save() {
    if (!draft || !canSave || command.current || !isCurrent()) return;
    command.current = draft;
    setSaving(true);
    try {
      const response = await savePreparationOutputNotes(session, draft.scope, draft.targets, productionNoteText(draft.text));
      if (!isCurrent() || command.current !== draft) return;
      setConfirmed(previous => {
        const next = new Map(previous);
        response.forEach((note, id) => { next.set(noteKey(draft.scope, id), note); });
        return next;
      });
      setDraft(null);
      if (draft.scope === 'rolls') clearSelection();
      refresh();
    } catch (error) {
      if (!isCurrent() || command.current !== draft) return;
      setDraft({ ...draft, error: error instanceof Error ? error.message : 'Eslatma saqlanmadi' });
      if (error instanceof WorkerControlException && error.statusCode === 409) refresh();
    } finally {
      if (command.current === draft) {
        command.current = null;
        if (isCurrent()) setSaving(false);
      }
    }
  }

  const editor: PreparationNoteDialogEditor = {
    state: { original: draft, draft: draft?.text ?? '', saving, error: draft?.error ?? null },
    canSave, count, limit: MAX_PRODUCTION_NOTE_CHARS, save,
    cancel: () => { if (!command.current) setDraft(null); },
    change: text => { if (!command.current) setDraft(value => value && text !== value.text ? { ...value, text, edited: true, error: null } : value); },
  };
  return {
    editor, latest, selected, clearSelection, toggle, openSelection,
    rollWithNotes: (roll: ProductionRoll) => ({ ...roll,
      roll_note: latest('rolls', roll.receipt_name, roll.roll_note),
      batch_note: latest('batch', roll.batch_id, roll.batch_note) }),
    openBatch: (id: string, note: PreparationOutputNote | null) => open('batch', [{ id, note }]),
    title: draft?.scope === 'batch' ? 'Batch eslatmasi' : 'Rulon eslatmasi',
    description: draft?.scope === 'batch' ? 'Eslatma shu batchdagi barcha rulonlarga tegishli.'
      : `${draft?.targets.length ?? 0} ta tanlangan rulonga eslatma qo‘yiladi.`,
  };
}
