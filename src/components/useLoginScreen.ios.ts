import { useNativeState } from '@expo/ui';
import { useEffect, useRef, useState } from 'react';
import { createRuntimeAccountSwitchController, loadSession, login, type Session } from '../auth';
import { authenticateAccount } from '../authenticateAccount';
import { MobileApi } from '../mobileApi';
import { loginCodeUsesNumericKeyboard, loginFailureMessage } from '../shared/loginLogic';
import { useBaseLocale } from './useBaseLocale.ios';

export function useLoginScreen(onLogin: (session: Session) => void, addAccountMode: boolean) {
  const { text } = useBaseLocale();
  const [server, setServer] = useState(MobileApi.instance.baseUrl);
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const codeField = useNativeState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const submitting = useRef(false);
  const mounted = useRef(false);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  const changeCode = (value: string) => {
    const numericPrefix = code.trim().length >= 2 && loginCodeUsesNumericKeyboard(code);
    const next = numericPrefix ? value.replace(/[^0-9]/g, '') : value;
    if (next !== value) codeField.set(next);
    setCode(next);
  };

  const submit = async () => {
    if (submitting.current) return;
    const normalizedPhone = phone.trim(), normalizedCode = code.trim();
    if (!normalizedPhone || !normalizedCode) { setError(text('loginRequiredFields')); return; }
    submitting.current = true;
    setBusy(true);
    setError('');
    try {
      if (addAccountMode) {
        const account = await authenticateAccount(server, normalizedPhone, normalizedCode);
        const controller = await createRuntimeAccountSwitchController(server);
        await controller.addAndSwitch({ baseUrl: server, profile: account.profile, token: account.token,
          phone: normalizedPhone, code: normalizedCode, werkaHomeBootstrap: account.werka_home });
        const session = await loadSession();
        if (!session) throw new Error('Account session is unavailable');
        if (mounted.current) onLogin(session);
      } else {
        const session = await login(server, normalizedPhone, normalizedCode);
        if (mounted.current) onLogin(session);
      }
    } catch (failure) {
      if (mounted.current) setError(loginFailureMessage(failure, {
        loginConnectionFailed: text('loginConnectionFailed'), loginFailed: text('loginFailed'),
      }));
    } finally {
      submitting.current = false;
      if (mounted.current) setBusy(false);
    }
  };

  return { text, server, setServer, phone, setPhone, code, codeField, changeCode, busy, error, submit,
    numericKeyboard: loginCodeUsesNumericKeyboard(code), canSubmit: !!phone.trim() && !!code.trim() };
}
