import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { createRuntimeAccountSwitchController, loadSession, login, type Session } from '../auth';
import { authenticateAccount } from '../authenticateAccount';
import { MobileApi } from '../mobileApi';
import { filterLoginCode, loginCodeUsesNumericKeyboard, loginFailureMessage } from '../shared/loginLogic';
import { localizedGetter } from '../shared/localization';
import { localeController } from '../shared/localization/runtime';

const subscribe = (listener: () => void) => localeController.addListener(listener);
const currentLocale = () => localeController.locale;

export function useLoginForm(onLogin: (session: Session) => void, addAccountMode: boolean) {
  const locale = useSyncExternalStore(subscribe, currentLocale, currentLocale);
  const text = (key: string) => localizedGetter(key, locale);
  const [server, setServer] = useState(MobileApi.instance.baseUrl);
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const submitting = useRef(false);
  const mounted = useRef(false);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  const changeCode = (value: string) => {
    const next = filterLoginCode(code, value);
    setCode(next);
    return next;
  };

  const submit = async (submittedCode = code) => {
    if (submitting.current) return;
    const normalizedPhone = phone.trim(), normalizedCode = submittedCode.trim();
    if (!normalizedPhone || !normalizedCode) { setError(text('loginRequiredFields')); return; }
    submitting.current = true;
    setBusy(true);
    setError('');
    try {
      let session: Session | null;
      if (addAccountMode) {
        const account = await authenticateAccount(server, normalizedPhone, normalizedCode);
        const controller = await createRuntimeAccountSwitchController(server);
        await controller.addAndSwitch({ baseUrl: server, profile: account.profile, token: account.token,
          phone: normalizedPhone, code: normalizedCode, werkaHomeBootstrap: account.werka_home });
        session = await loadSession();
        if (!session) throw new Error('Account session is unavailable');
      } else {
        session = await login(server, normalizedPhone, normalizedCode);
      }
      if (mounted.current) onLogin(session);
    } catch (failure) {
      if (mounted.current) setError(loginFailureMessage(failure, {
        loginConnectionFailed: text('loginConnectionFailed'), loginFailed: text('loginFailed'),
      }));
    } finally {
      submitting.current = false;
      if (mounted.current) setBusy(false);
    }
  };

  return { text, server, setServer, phone, setPhone, code, changeCode, busy, error, submit,
    numericKeyboard: loginCodeUsesNumericKeyboard(code), canSubmit: !!phone.trim() && !!code.trim() };
}
