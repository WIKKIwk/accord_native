import { useRef, useState } from 'react';
import type { QolipLocationEntry } from './qolipLocationsApi';
import { qolipIssueCheckout, type QolipWorkerOption } from './qolipCheckoutApi';
import { qolipErrorMessage } from './qolipErrorMessage';
import { qolipHomeQuantity } from './qolipHomeCommands';
import { useQolipRole } from './QolipRoleContext';
import { useQolipPassiveBoundary } from './useQolipPassiveBoundary';
import { useQolipText } from './useQolipText';

export type QolipTakeProps = { item: QolipLocationEntry; chooseWorker(): Promise<QolipWorkerOption | null>; saved(): void };
export function useQolipTake(props: QolipTakeProps) {
  const role = useQolipRole(), lifetime = useQolipPassiveBoundary(role.boundary), { text, locale } = useQolipText();
  const [quantity, setQuantity] = useState('1'), [worker, setWorker] = useState<QolipWorkerOption | null>(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState<string | null>(null), sending = useRef(false);
  const selectWorker = async () => {
    if (sending.current || !lifetime.isCurrent()) return;
    const selected = await props.chooseWorker();
    if (selected && lifetime.isCurrent()) { setWorker(selected); setError(null); }
  };
  const submit = async () => {
    if (sending.current || !lifetime.isCurrent()) return;
    const parsed = qolipHomeQuantity(quantity, props.item.quantity);
    if (parsed.error) { setError(text(parsed.error, { count: props.item.quantity })); return; }
    if (!worker) { setError(text('home.choose_worker')); return; }
    sending.current = true; setBusy(true); setError(null);
    try {
      await qolipIssueCheckout(role.session, { locationId: props.item.id, quantity: parsed.quantity, workerId: worker.id }, lifetime.isCurrent);
      if (lifetime.isCurrent()) props.saved();
    } catch (reason) { if (lifetime.isCurrent()) setError(qolipErrorMessage(reason, locale, text('home.take_failed'))); }
    finally { sending.current = false; if (lifetime.isCurrent()) setBusy(false); }
  };
  return { valid: lifetime.valid, quantity, setQuantity: (value: string) => setQuantity(value.replace(/[^0-9]/g, '')), worker, busy, error,
    text, selectWorker: () => { void selectWorker(); }, submit: () => { void submit(); } };
}
