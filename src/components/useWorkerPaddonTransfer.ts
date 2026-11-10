import { useEffect, useMemo, useRef, useState } from 'react';
import type { Session } from '../auth';
import { adminText, localizedGetter } from '../shared/localization';
import { workerPaddonLocation, workerPaddonErrorText } from '../workerPaddonContent';
import { workerPaddonMovable, type WorkerPaddonBatch } from '../workerPaddonModel';
import { rezkaPaddonWipContent } from '../rezka/rezkaPaddonWipModel';
import { useWorkerPaddonOwner, useWorkerPaddonState } from './useWorkerPaddonOwner';
import { useWorkerPaddonPresentation } from './useWorkerPaddonPresentation';
import { useWorkerOrderText } from './useWorkerOrderText';

export type WorkerPaddonTransferProps = { session: Session; apparatus?: string; onBack(): void };
export function useWorkerPaddonTransfer({ session, apparatus = '' }: WorkerPaddonTransferProps) {
  const owner = useWorkerPaddonOwner(session, apparatus), controller = useMemo(() => owner.transfer(), [owner]);
  const state = useWorkerPaddonState(controller), { p, t, locale } = useWorkerOrderText(), presentation = useWorkerPaddonPresentation(owner.current);
  const confirming = useRef(false), [confirmationOpen, setConfirmationOpen] = useState(false);
  useEffect(() => { void controller.load(); }, [controller]);
  const blocked = !owner.current() || state.busy || confirmationOpen;
  const location = (paddon: NonNullable<typeof state.source>['paddon']) => workerPaddonLocation(paddon, state.catalog, adminText('wip.unspecified', locale));
  const errorText = () => {
    const error = controller.getSnapshot().error;
    return error && typeof error === 'object' && 'code' in error && error.code === 'paddon_transfer_forbidden'
      ? p('worker.paddon.transfer.forbidden') : workerPaddonErrorText(error, p, 'worker.paddon.transfer.failed');
  };
  async function move(source: string, ids: string[]) {
    const s = controller.getSnapshot(), target = [s.source, s.target].find(row => row && row.paddon.code !== source)?.paddon.code;
    if (confirming.current || blocked || s.phase !== 'ready' || !ids.length || !target || !controller.editable(s.source) || !controller.editable(s.target)) return;
    const permit = controller.capture(); confirming.current = true; setConfirmationOpen(true);
    try {
      if (await presentation.open({ title: p('worker.paddon.transfer.title'), message: p('worker.paddon.transfer.confirm', { count: ids.length, source, target }),
        cancelLabel: p('worker.action.cancel'), confirmLabel: p('worker.paddon.transfer.move', { count: ids.length }) }) !== 'confirm' || !permit()) return;
      if (await controller.move(source, target, ids, permit)) presentation.message(p('worker.paddon.transfer.success'));
      else if (controller.current()) presentation.message(errorText());
    } finally { confirming.current = false; if (owner.current()) setConfirmationOpen(false); }
  }
  const sides = (['source', 'target'] as const).map(side => {
    const snapshot = state[side], editable = controller.editable(snapshot);
    return { side, code: snapshot?.paddon.code ?? '', title: snapshot ? [snapshot.paddon.code, location(snapshot.paddon)].filter(Boolean).join(' • ')
      : p(`worker.paddon.transfer.${side}`), empty: p(snapshot ? 'worker.paddon.transfer.empty' : 'worker.paddon.transfer.choose'),
      rows: (snapshot?.items ?? []).map(batch => ({ batch, ...rezkaPaddonWipContent(batch, state.catalog, session.profile, p),
        selected: state.selectedCode === snapshot?.paddon.code && state.selected.includes(batch.batch_id), selectable: editable && workerPaddonMovable(batch) && !blocked })),
    };
  });
  return { state, controller, presentation, sides, blocked, confirmationOpen, p, t, current: controller.current,
    loadFailed: localizedGetter('serverDisconnectedRetry', locale), title: p('worker.paddon.transfer.title'), canMove: !blocked && state.selected.length > 0 && controller.editable(state.source) && controller.editable(state.target),
    async pick(side: 'source' | 'target') {
      if (blocked || controller.getSnapshot().phase !== 'ready' || presentation.isOpen()) return; const permit = controller.capture(), other = side === 'source' ? state.target : state.source;
      const code = await presentation.pick(state.rows.filter(row => row.code !== other?.paddon.code).map(row => ({ id: row.code, title: row.code,
        subtitle: [location(row), `${row.item_count} WIP`].filter(Boolean).join(' • ') })));
      if (!code || !permit()) return; await controller.pick(side, code, permit);
      if (permit() && controller.getSnapshot().error) presentation.message(errorText());
    },
    move: () => move(state.selectedCode, [...state.selected]),
    dragIds(source: string, batch: WorkerPaddonBatch) {
      const s = controller.getSnapshot(), from = [s.source, s.target].find(row => row?.paddon.code === source);
      if (!from || blocked || s.phase !== 'ready' || presentation.isOpen() || !controller.editable(from) || !workerPaddonMovable(batch)) return [];
      return s.selectedCode === source && s.selected.includes(batch.batch_id)
        ? from.items.filter(row => s.selected.includes(row.batch_id) && workerPaddonMovable(row)).map(row => row.batch_id) : [batch.batch_id];
    }, drop: move,
  };
}
