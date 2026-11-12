import { useFocusEffect } from 'expo-router';
import { useCallback, useLayoutEffect, useRef } from 'react';
import type { Session } from '../auth';
import { adminText } from '../shared/localization';
import { workerPaddonCanDelete, workerPaddonCanTransfer, type WorkerPaddon } from '../workerPaddonModel';
import { workerPaddonErrorText } from '../workerPaddonContent';
import { useWorkerPaddonOwner, useWorkerPaddonState } from './useWorkerPaddonOwner';
import { useWorkerPaddonPresentation } from './useWorkerPaddonPresentation';
import { useWorkerOrderText } from './useWorkerOrderText';

export type WorkerPaddonListProps = { session: Session; apparatus?: string; name?: string; visible?: boolean; onBack(): void;
  onDetail(code: string, apparatus: string, name: string): void; onTransfer(apparatus: string): void };

export function useWorkerPaddonList({ session, apparatus = '', visible = true, onDetail, onTransfer }: WorkerPaddonListProps) {
  const owner = useWorkerPaddonOwner(session, apparatus), controller = owner.list, state = useWorkerPaddonState(controller);
  const { p, t, locale } = useWorkerOrderText(), presentation = useWorkerPaddonPresentation(owner.current);
  const presenting = useRef(presentation.isOpen); useLayoutEffect(() => { presenting.current = presentation.isOpen; }, [presentation.isOpen]);
  useFocusEffect(useCallback(() => { if (visible && !presenting.current()) void controller.load(); }, [controller, visible]));
  const showError = (key: string) => presentation.message(workerPaddonErrorText(controller.getSnapshot().error, p, key));
  const canDelete = workerPaddonCanDelete(session), canTransfer = workerPaddonCanTransfer(session, state.options, state.apparatus);
  const enabled = visible && owner.current() && state.phase === 'ready' && !state.busy;
  return { state, controller, presentation, current: owner.current, p, t,
    title: state.name ? p('worker.paddon.apparatus', { apparatus: state.name }) : p('worker.paddons'),
    enabled, canCreate: enabled && state.options.some(row => row.id === state.apparatus), canTransfer: enabled && canTransfer, canDelete: enabled && canDelete,
    async create() { if (!enabled) return; const row = await controller.create();
      if (owner.current()) { if (row) onDetail(row.code, state.apparatus, state.name); else showError('worker.paddon.create_failed'); } },
    open(row: WorkerPaddon) { if (enabled) onDetail(row.code, state.apparatus, state.name); },
    transfer() { if (enabled && canTransfer) onTransfer(state.apparatus); },
    async remove(row: WorkerPaddon) {
      if (!enabled || !canDelete) return;
      const permit = controller.capture(), label = adminText('action.delete', locale);
      if (await presentation.pick([{ id: 'delete', title: label, destructive: true }], true) !== 'delete' || !permit()) return;
      if (await presentation.open({ title: p('worker.paddon.delete.title'), message: p('worker.paddon.delete.body', { code: row.code }),
        cancelLabel: p('worker.action.cancel'), confirmLabel: label, destructive: true }) !== 'confirm' || !permit()) return;
      if (await controller.remove(row.code, permit)) presentation.message(p('worker.paddon.deleted')); else if (permit()) showError('worker.paddon.delete_failed');
    },
  };
}
