import { useNativeState } from '@expo/ui/swift-ui';
import { useEffect, useRef, useState } from 'react';
import { Alert } from 'react-native';
import type { Session } from '../auth';
import { switchPinStore } from '../shared/switchPinRuntime';
import { useBaseLocale } from './useBaseLocale.ios';

type Stage = 'entry' | 'confirm' | null;

export function useSwitchPinSetup(session: Session) {
  const { text } = useBaseLocale();
  const field = useNativeState('');
  const [hasPin, setHasPin] = useState<boolean | null>(null);
  const [stage, setStage] = useState<Stage>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const current = useRef('');
  const first = useRef('');
  const pending = useRef(false);
  const mounted = useRef(false);

  useEffect(() => {
    mounted.current = true;
    void switchPinStore.has(session).then(value => { if (mounted.current) setHasPin(value); }, () => {
      if (mounted.current) Alert.alert(text('switchPinTitle'), text('pinSaveFailed'));
    });
    return () => { mounted.current = false; };
    // The session identity owns this screen's state; changing the language must not reload the PIN.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  const clearInput = () => { current.current = ''; field.set(''); setError(''); };
  const change = (value: string) => {
    const next = value.replace(/\D/g, '').slice(0, 4);
    current.current = next;
    if (value !== next) field.set(next);
    setError('');
  };
  const open = () => { if (!pending.current) { first.current = ''; clearInput(); setStage('entry'); } };
  const back = () => {
    if (pending.current) return;
    clearInput();
    first.current = '';
    setStage(stage === 'confirm' ? 'entry' : null);
  };
  const close = () => {
    if (pending.current) return;
    clearInput();
    first.current = '';
    setStage(null);
  };
  const submit = async () => {
    if (pending.current || !stage) return;
    const pin = current.current.trim();
    if (stage === 'entry') {
      if (pin.length !== 4) return;
      first.current = pin;
      clearInput();
      setStage('confirm');
      return;
    }
    if (pin !== first.current) { clearInput(); setError(text('pinMismatch')); return; }
    pending.current = true;
    setBusy(true);
    try {
      await switchPinStore.save(session, pin);
      if (mounted.current) { setHasPin(true); clearInput(); first.current = ''; setStage(null); }
    } catch {
      if (mounted.current) { clearInput(); setError(text('pinSaveFailed')); }
    } finally {
      pending.current = false;
      if (mounted.current) setBusy(false);
    }
  };
  const remove = async () => {
    if (pending.current || !hasPin) return;
    pending.current = true;
    setBusy(true);
    try {
      await switchPinStore.clear(session);
      if (mounted.current) setHasPin(false);
    } catch {
      if (mounted.current) Alert.alert(text('switchPinTitle'), text('pinRemoveFailed'));
    } finally {
      pending.current = false;
      if (mounted.current) setBusy(false);
    }
  };
  return { field, hasPin, stage, busy, error, change, open, back, close, submit, remove };
}
