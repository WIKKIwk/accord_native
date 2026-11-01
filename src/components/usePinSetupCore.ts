import { useEffect, useRef, useState } from 'react';
import { Alert } from 'react-native';
import { useWorkerSecurity } from './WorkerSecurity';

type Mode = 'set' | 'remove' | null;

export function usePinSetupCore<T extends { set: (value: string) => void }>(current: T, pin: T, repeat: T) {
  const security = useWorkerSecurity();
  const [mode, setMode] = useState<Mode>(null);
  const [busy, setBusy] = useState(false);
  const saving = useRef(false);
  const mounted = useRef(true);
  const values = useRef({ current: '', pin: '', repeat: '' });
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);

  const change = (name: 'current' | 'pin' | 'repeat', value: string) => { values.current[name] = value; };
  const reset = () => {
    values.current = { current: '', pin: '', repeat: '' };
    current.set(''); pin.set(''); repeat.set('');
  };
  const open = (next: Exclude<Mode, null>) => { reset(); setMode(next); };
  const close = () => { if (!busy) { reset(); setMode(null); } };
  const submit = async () => {
    if (saving.current || !mode) return;
    const entered = values.current;
    if (mode === 'set' && (!/^\d{4}$/.test(entered.pin) || entered.pin !== entered.repeat)) {
      Alert.alert('PIN noto‘g‘ri', '4 ta raqam kiriting va PIN’ni bir xil takrorlang.');
      return;
    }
    saving.current = true;
    setBusy(true);
    try {
      if (mode === 'remove') await security.removePin(entered.current);
      else await security.savePin(entered.pin, entered.current);
      if (mounted.current) { reset(); setMode(null); }
    } catch (error) {
      if (mounted.current) Alert.alert('Saqlab bo‘lmadi', error instanceof Error ? error.message : 'Qayta urinib ko‘ring.');
    } finally { saving.current = false; if (mounted.current) setBusy(false); }
  };
  return { security, mode, busy, current, pin, repeat, change, open, close, submit };
}
