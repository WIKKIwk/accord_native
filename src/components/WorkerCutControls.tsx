import { createContext, useContext, useEffect, type ReactNode } from 'react';
import type { Session } from '../auth';
import { openWorkerCutPanel } from '../workerPeremotka';
import { useWorkerActivePaddon } from './useWorkerActivePaddon';
import { useWorkerPeremotka } from './useWorkerPeremotka';
import { WorkerActivePaddonButton, WorkerActivePaddonPicker } from './WorkerActivePaddon';
import { WorkerCutToolbar } from './WorkerCutToolbar';
import { WorkerPaddonFeedback } from './WorkerPaddonFeedback';
import { WorkerPeremotkaButton, WorkerPeremotkaSheet } from './WorkerPeremotka';

type Controls = {
  activePaddon: ReturnType<typeof useWorkerActivePaddon>;
  peremotka: ReturnType<typeof useWorkerPeremotka>;
};
const WorkerCutContext = createContext<Controls>(null!);

/** Keep picker updates local, like V2's ActiveRezkaPaddonAction widget. */
export function WorkerCutControls({ session, apparatus, visible, revision, onBusyChange, children }: {
  session: Session; apparatus: string; visible: boolean; revision: string; onBusyChange(): void; children: ReactNode;
}) {
  const peremotka = useWorkerPeremotka(session, apparatus, visible);
  const activePaddon = useWorkerActivePaddon(session, apparatus, visible && peremotka.state.phase === 'closed', revision);
  useEffect(() => { onBusyChange(); }, [activePaddon.state.busy, onBusyChange]);
  // Unchanged children let the queue stay mounted without rendering its rows on picker updates.
  return <WorkerCutContext.Provider value={{ activePaddon, peremotka }}>{children}</WorkerCutContext.Provider>;
}

export function WorkerCutToolbarActions() {
  const { activePaddon, peremotka } = useContext(WorkerCutContext);
  return <WorkerCutToolbar>
    <WorkerPeremotkaButton {...peremotka} disabled={activePaddon.state.busy}
      onOpen={() => openWorkerCutPanel('peremotka', activePaddon.controller, peremotka.controller)} />
    <WorkerActivePaddonButton {...activePaddon}
      onOpen={() => openWorkerCutPanel('paddon', activePaddon.controller, peremotka.controller)} />
  </WorkerCutToolbar>;
}

export function WorkerCutSheets({ notice }: { notice: string }) {
  const { activePaddon, peremotka } = useContext(WorkerCutContext);
  return <>
    <WorkerActivePaddonPicker {...activePaddon} />
    <WorkerPeremotkaSheet {...peremotka} />
    <WorkerPaddonFeedback message={notice || activePaddon.notice} />
  </>;
}
