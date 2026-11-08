import { useCallback, useEffect, useState } from 'react';

/** Queue notices in the same order as V2's ScaffoldMessenger. */
export function useQolipNotice() {
  const [messages, setMessages] = useState<{ id: number; text: string }[]>([]);
  const show = useCallback((text: string) => setMessages(current => [...current, { id: (current.at(-1)?.id ?? 0) + 1, text }]), []);
  const activeId = messages[0]?.id;
  useEffect(() => {
    if (activeId === undefined) return;
    const timer = setTimeout(() => setMessages(current => current.slice(1)), 4000);
    return () => clearTimeout(timer);
  }, [activeId]);
  return { message: messages[0]?.text ?? '', show };
}
