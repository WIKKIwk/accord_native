import { useEffect, useEffectEvent, useState } from 'react';
import { activeSessionToken, type Session } from '../auth';
import { sessionReadScope } from '../sessionReadScope';
import { readWorkerInputProgress, workerInputProgressError, workerInputProgressModel, type WorkerInputProgressSource, type WorkerInputSelection } from '../workerInputProgress';
import { useWorkerOrderText } from './useWorkerOrderText';

type Props = { session: Session; source: WorkerInputProgressSource; enabled: boolean; readKey: string; current(): boolean;
  label(id: string): string; onSelection(selected: WorkerInputSelection | null, expected: WorkerInputSelection): void };
type State = { key: string; batches: Record<string, any>[]; loading: boolean; error: string };

export function useWorkerInputProgress({ session, source, enabled, readKey, current, label, onSelection }: Props) {
  const { p } = useWorkerOrderText();
  const scope = sessionReadScope(session);
  const key = JSON.stringify([scope, readKey, source.apparatusId, source.orderId, source.stageId, source.previousStage,
    source.previousRequired, source.openingRequired]);
  const [state, setState] = useState<State>({ key: '', batches: [], loading: true, error: '' });
  const isCurrent = useEffectEvent(current), selectionChanged = useEffectEvent(onSelection);
  const errorText = useEffectEvent((failure: unknown) => workerInputProgressError(failure, p));
  useEffect(() => {
    if (!enabled) return;
    let active = true;
    const valid = () => active && !!activeSessionToken(session) && scope === sessionReadScope(session) && isCurrent();
    if (!valid()) return;
    void Promise.resolve().then(() => {
      if (!valid()) return null;
      setState({ key, batches: [], loading: true, error: '' });
      return readWorkerInputProgress(session, source, valid);
    }).then(result => {
      if (!result || !valid()) return;
      setState({ key, batches: result.batches, loading: false, error: '' });
      if (source.selected) selectionChanged(result.selected, source.selected);
    }).catch(failure => {
      if (!valid()) return;
      setState({ key, batches: [], loading: false, error: errorText(failure) });
      if (source.selected) selectionChanged(null, source.selected);
    });
    return () => { active = false; };
    // The key identifies the complete read scope; selection changes do not depend on batch object identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, enabled, key, source.section, source.map]);
  return workerInputProgressModel({ source, batches: state.key === key ? state.batches : [],
    loading: state.key !== key || state.loading, error: state.key === key ? state.error : '' }, p, label);
}
