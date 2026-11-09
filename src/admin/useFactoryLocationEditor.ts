import { useLayoutEffect, useRef, useState } from 'react';
import { dartTrim } from './dartJsonString';
import { factoryLocationEditorPlan, selectedFactoryApparatus } from './factoryLocationEditorModel';
import { factoryLocationEditorText } from './factoryLocationEditorText';
import type { FactoryLocationEditorProps } from './factoryLocationEditorTypes';

export function useFactoryLocationEditor(props: FactoryLocationEditorProps, locale: string) {
  const [ticket] = useState(() => props.ticket), location = ticket.location, stale = props.ticket !== ticket,
    [name, setName] = useState(location?.name ?? ''),
    [selected, setSelected] = useState(() => new Set(location?.apparatus.map(item => item.id) ?? [])),
    [pickerOpen, setPickerOpen] = useState(false);
  const lifecycle = useRef(0), activeTicket = useRef<typeof ticket | null>(ticket), pickerBusy = useRef(false), finished = useRef(false);
  useLayoutEffect(() => {
    const lifetime = lifecycle, active = activeTicket; lifetime.current++; active.current = props.ticket;
    return () => { lifetime.current++; active.current = null; };
  }, [props.ticket]);
  const text = factoryLocationEditorText(locale, location);
  const openPicker = async () => {
    if (stale || activeTicket.current !== ticket || pickerBusy.current || finished.current) return;
    const generation = lifecycle.current;
    pickerBusy.current = true; setPickerOpen(true);
    try {
      const result = await props.openPicker(new Set(selected));
      if (generation === lifecycle.current && result != null) setSelected(new Set(result));
    } finally {
      if (generation === lifecycle.current) { pickerBusy.current = false; setPickerOpen(false); }
    }
  };
  const remove = (id: string) => {
    if (stale || activeTicket.current !== ticket || pickerBusy.current || finished.current) return;
    setSelected(current => { const next = new Set(current); next.delete(id); return next; });
  };
  const submit = () => {
    if (stale || activeTicket.current !== ticket || pickerBusy.current || finished.current) return;
    if (factoryLocationEditorPlan(location, name, selected).kind === 'nameRequired') { props.showInvalidName(text.nameRequired); return; }
    finished.current = true;
    try { props.onSubmit(ticket, dartTrim(name), new Set(selected)); }
    catch (error) { finished.current = false; throw error; }
  };
  const cancel = () => {
    if (stale || activeTicket.current !== ticket || pickerBusy.current || finished.current) return;
    finished.current = true;
    try { props.onCancel(); } catch (error) { finished.current = false; throw error; }
  };
  return { text, name, stale, setName: (value: string) => { if (!stale && activeTicket.current === ticket && !location && !pickerBusy.current && !finished.current) setName(value); },
    selected, visibleSelected: selectedFactoryApparatus(props.apparatus, selected), pickerOpen, openPicker, remove, submit, cancel };
}
