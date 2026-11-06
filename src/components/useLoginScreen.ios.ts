import { useNativeState } from '@expo/ui';
import type { Session } from '../auth';
import { useLoginForm } from './useLoginForm';

export function useLoginScreen(onLogin: (session: Session) => void, addAccountMode: boolean) {
  const form = useLoginForm(onLogin, addAccountMode);
  const codeField = useNativeState('');
  const changeCode = (value: string) => {
    const next = form.changeCode(value);
    if (next !== value) codeField.set(next);
  };
  return { ...form, codeField, changeCode };
}
