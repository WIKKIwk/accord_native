import { useLayoutEffect, useRef, useState } from 'react';
import { dartTrim } from './dartJsonString';
import { factoryLocationRenameText } from './factoryLocationRenameText';
import type { FactoryLocationRenameProps } from './factoryLocationRenameTypes';

export function useFactoryLocationRename(props: FactoryLocationRenameProps, locale: string) {
  const [ticket] = useState(() => props.ticket), stale = props.ticket !== ticket || !ticket.location;
  const [name, setName] = useState(ticket.location?.name ?? ''), activeTicket = useRef<typeof ticket | null>(ticket), finished = useRef(false);
  useLayoutEffect(() => {
    const active = activeTicket; active.current = props.ticket;
    return () => { active.current = null; };
  }, [props.ticket]);
  const submit = () => {
    if (stale || activeTicket.current !== ticket || finished.current) return;
    const value = dartTrim(name);
    if (!value) return;
    finished.current = true;
    try { props.onSubmit(ticket, value); } catch (error) { finished.current = false; throw error; }
  };
  const cancel = () => {
    if (stale || activeTicket.current !== ticket || finished.current) return;
    finished.current = true;
    try { props.onCancel(); } catch (error) { finished.current = false; throw error; }
  };
  return { text: factoryLocationRenameText(locale), stale,
    setName: (value: string) => { if (!stale && activeTicket.current === ticket && !finished.current) setName(value); }, submit, cancel };
}
