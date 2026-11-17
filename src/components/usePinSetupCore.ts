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
  const currentAccount = () => security.isCurrent === undefined || security.isCurrent() === true;
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);

  const change = (name: 'current' | 'pin' | 'repeat', value: string) => { if (currentAccount()) values.current[name] = value; };
  const reset = () => {
    values.current = { current: '', pin: '', repeat: '' };
    current.set(''); pin.set(''); repeat.set('');
  };
  const open = (next: Exclude<Mode, null>) => { if (currentAccount()) { reset(); setMode(next); } };
  const close = () => { if (!busy && currentAccount()) { reset(); setMode(null); } };
  const submit = async (): Promise<boolean> => {
    if (!currentAccount() || saving.current || !mode) return false;
    const entered = values.current;
    if (mode === 'set' && (!/^\d{4}$/.test(entered.pin) || entered.pin !== entered.repeat)) {
      Alert.alert('PIN noto‘g‘ri', '4 ta raqam kiriting va PIN’ni bir xil takrorlang.');
      return false;
    }
    saving.current = true;
    setBusy(true);
    try {
      if (mode === 'remove') await security.removePin();
      else await security.savePin(entered.pin);
      if (mounted.current && currentAccount()) { reset(); setMode(null); }
      return currentAccount();
    } catch (error) {
      if (mounted.current && currentAccount()) Alert.alert('Saqlab bo‘lmadi', error instanceof Error ? error.message : 'Qayta urinib ko‘ring.');
      return false;
    } finally { saving.current = false; if (mounted.current && currentAccount()) setBusy(false); }
  };
  const remove = async (): Promise<boolean> => {
    if (!currentAccount() || saving.current) return false;
    saving.current = true; setBusy(true);
    try { await security.removePin(); return currentAccount(); }
    catch { if (mounted.current && currentAccount()) Alert.alert('PIN kod', 'PIN’ni olib tashlab bo‘lmadi.'); return false; }
    finally { saving.current = false; if (mounted.current && currentAccount()) setBusy(false); }
  };
  return { security, mode, busy, current, pin, repeat, change, open, close, submit, remove };
}
