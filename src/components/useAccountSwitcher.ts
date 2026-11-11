import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { BackHandler, Platform } from 'react-native';
import { activeSessionToken, createRuntimeAccountSwitchController, loadSession, type Session } from '../auth';
import { initializeSavedAccounts } from '../savedAccountRuntime';
import type { SavedAccount } from '../savedAccountStore';
import { localizedGetter, localizedMethod } from '../shared/localization';
import { localeController } from '../shared/localization/runtime';
import { switchPinStore } from '../shared/switchPinRuntime';
import { savedAccountDisplayName } from '../shared/accountEntryLogic';

export type AccountSwitcherProps = {
  onSwitched: (session: Session) => void;
  onAddAccount: () => void;
  onEmpty: () => void;
};
type Snapshot = { session: Session; accounts: SavedAccount[]; activeId: string | null; pins: Record<string, boolean> };
const subscribe = (listener: () => void) => localeController.addListener(listener);
const localeSnapshot = () => localeController.locale;
const pinAccount = (account: SavedAccount) => ({ baseUrl: account.base_url, profile: account.profile });

/** @v2 AccountSwitcherSheet */
export function useAccountSwitcher<T extends { set: (value: string) => void }>(
  field: T, { onSwitched, onAddAccount, onEmpty }: AccountSwitcherProps,
) {
  const locale = useSyncExternalStore(subscribe, localeSnapshot, localeSnapshot);
  const text = (key: string) => localizedGetter(key, locale);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [target, setTarget] = useState<SavedAccount | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const mounted = useRef(false), pending = useRef(false), pin = useRef('');

  useEffect(() => {
    mounted.current = true;
    let active = true;
    void (async () => {
      try {
        const session = await loadSession();
        if (!session) throw new Error('Account session is unavailable');
        const store = await initializeSavedAccounts(session.baseUrl);
        const accounts = store.accountsForEndpoint(session.baseUrl);
        const pins = Object.fromEntries(await Promise.all(accounts.map(async account =>
          [account.id, await switchPinStore.has(pinAccount(account))] as const)));
        if (!active) return;
        setSnapshot({ session, accounts, activeId: store.activeAccountId, pins });
        if (!accounts.length) onEmpty();
      } catch { if (active) setError(localizedGetter('accountSwitchFailed', localeController.locale)); }
      finally { if (active) setLoading(false); }
    })();
    return () => { active = false; mounted.current = false; };
  }, [onEmpty]);

  const clearPin = () => { pin.current = ''; field.set(''); };
  const changePin = (value: string) => {
    const next = value.replace(/\D/g, '').slice(0, 4);
    pin.current = next;
    if (next !== value) field.set(next);
  };
  const back = () => {
    if (pending.current) return;
    setTarget(null); clearPin(); setError('');
  };
  useEffect(() => {
    if (Platform.OS !== 'android' || (!target && !busy)) return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => { back(); return true; });
    return () => subscription.remove();
  });

  const switchAccount = async (account: SavedAccount) => {
    const controller = await createRuntimeAccountSwitchController(account.base_url);
    if (!mounted.current) return;
    await controller.switchTo(account.id);
    const session = await loadSession();
    if (!session) throw new Error('Account session is unavailable');
    // A committed switch must replace the old role even if the sheet was dismissed meanwhile.
    onSwitched(session);
  };
  const select = async (account: SavedAccount) => {
    if (pending.current || !snapshot || account.id === snapshot.activeId) return;
    pending.current = true; setBusy(true); setError('');
    try {
      if (!activeSessionToken(snapshot.session)) throw new Error('Account session changed');
      const protectedAccount = await switchPinStore.has(pinAccount(account));
      if (!mounted.current) return;
      if (protectedAccount) { clearPin(); setTarget(account); }
      else await switchAccount(account);
    } catch { if (mounted.current) setError(text('accountSwitchFailed')); }
    finally { pending.current = false; if (mounted.current) setBusy(false); }
  };
  const verify = async (submittedPin = pin.current) => {
    if (pending.current || !target || !snapshot) return;
    pending.current = true; setBusy(true); setError('');
    try {
      if (!activeSessionToken(snapshot.session)) throw new Error('Account session changed');
      const verified = await switchPinStore.verify(pinAccount(target), submittedPin);
      if (!mounted.current) return;
      if (!verified) { clearPin(); setError(text('pinWrong')); return; }
      await switchAccount(target);
    } catch { if (mounted.current) setError(text('accountSwitchFailed')); }
    finally { pending.current = false; if (mounted.current) setBusy(false); }
  };
  const addAccount = () => { if (snapshot && !pending.current) onAddAccount(); };

  return { accounts: snapshot?.accounts ?? [], activeId: snapshot?.activeId, pins: snapshot?.pins ?? {},
    ready: !!snapshot, loading, target, busy, error, field, text, changePin, back, select, verify, addAccount,
    pinPrompt: target ? localizedMethod('accountPinPrompt', locale, { name: savedAccountDisplayName(target) }) : '' };
}
