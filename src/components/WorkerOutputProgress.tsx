import type { Session } from '../auth';

export type WorkerOutputProgressProps = {
  session: Session;
  orderId: string;
  apparatusId: string;
  stageId: string;
  map: Record<string, unknown>;
};

export function WorkerOutputProgress(_props: WorkerOutputProgressProps) {
  return null;
}
