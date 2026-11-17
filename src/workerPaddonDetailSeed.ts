import { captureSessionWitness, isSessionWitnessCurrent, type Session } from './auth';
import { sessionReadScope } from './sessionReadScope';
import type { WorkerPaddonSnapshot } from './workerPaddonModel';
/** @v2 AparatchiPaddonDetailSeed: an original, one-consumption scan handoff. */
export class WorkerPaddonDetailSeed {
  private consumed = false; private readonly scope:string; private readonly witness:ReturnType<typeof captureSessionWitness>;
  constructor(private readonly session:Session,private readonly snapshot:WorkerPaddonSnapshot) { this.scope = sessionReadScope(session); this.witness = captureSessionWitness(session); }
  takeForCode(code:string) { if (this.consumed) return null; this.consumed = true; return isSessionWitnessCurrent(this.witness) && this.scope === sessionReadScope(this.session) && !!code.trim() && this.snapshot.paddon.code.trim() === code.trim() ? this.snapshot : null; }
}
