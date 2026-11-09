import { useCallback, useEffect, useState } from 'react';

type Queue = { nextId: number; messages: { id: number; text: string }[] };
/** Queue notices in the same order as V2's ScaffoldMessenger. */
export function useQolipNotice() {
  const [queue, setQueue] = useState<Queue>({ nextId: 1, messages: [] });
  const show = useCallback((text: string) => setQueue(current => ({ nextId: current.nextId + 1,
    messages: [...current.messages, { id: current.nextId, text }] })), []);
  const activeId = queue.messages[0]?.id;
  useEffect(() => {
    if (activeId === undefined) return;
    const timer = setTimeout(() => setQueue(current => ({ ...current, messages: current.messages.slice(1) })), 4000);
    return () => clearTimeout(timer);
  }, [activeId]);
  return { message: queue.messages[0]?.text ?? '', show };
}
