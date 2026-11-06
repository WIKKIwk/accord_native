import { createContext, useCallback, useContext, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { ActivityIndicator, Alert, AppState, Modal, Pressable, StyleSheet, Text, TextInput, useColorScheme, View } from 'react-native';
import type { Session } from '../auth';
import { biometricAvailable, clearAppLock, loadAppLock, saveAppPin, setAppBiometric, unlockAppWithBiometric, verifyAppPin } from '../appLock';
import { consumeLoginUnlock } from '../shared/securityUnlockRuntime';
import { localizedGetter } from '../shared/localization';
import { localeController } from '../shared/localization/runtime';

const subscribeLocale = (listener: () => void) => localeController.addListener(listener);
const currentLocale = () => localeController.locale;

type Security = {
  hasPin: boolean;
  biometric: boolean;
  canUseBiometric: boolean;
  savePin: (pin: string) => Promise<void>;
  removePin: () => Promise<void>;
  setBiometric: (enabled: boolean) => Promise<void>;
};

export const SecurityContext = createContext<Security | null>(null);

export function useWorkerSecurity(): Security {
  const value = useContext(SecurityContext);
  if (!value) throw new Error('Xavfsizlik sozlamalari mavjud emas.');
  return value;
}

export function WorkerSecurityProvider({ session, onLogout, children }: { session: Session; onLogout: () => void; children: ReactNode }) {
  const locale = useSyncExternalStore(subscribeLocale, currentLocale, currentLocale);
  const text = (key: string) => localizedGetter(key, locale);
  const dark = useColorScheme() === 'dark';
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [hasPin, setHasPin] = useState(false);
  const [biometric, setBiometric] = useState(false);
  const [locked, setLocked] = useState(false);
  const [shield, setShield] = useState(false);
  const [input, setInput] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const pinPresent = useRef(false);
  const wasInactive = useRef(false);
  const authenticating = useRef(false);
  const unlocking = useRef(false);
  const autoBiometricAttempted = useRef(false);
  const lifecycleEpoch = useRef(0);
  const mounted = useRef(false);

  const load = useCallback(async () => {
    try {
      const state = await loadAppLock(session);
      if (!mounted.current) return;
      pinPresent.current = state.hasPin;
      setHasPin(state.hasPin);
      setBiometric(state.biometric);
      setLocked(state.hasPin && !(AppState.currentState === 'active' && consumeLoginUnlock(session)));
      setLoadError('');
    } catch {
      if (mounted.current) setLoadError('Qulf ma’lumotini yuklab bo‘lmadi.');
    } finally { if (mounted.current) setLoaded(true); }
  }, [session]);

  useEffect(() => {
    mounted.current = true;
    let active = true;
    void loadAppLock(session).then(state => {
      if (!active) return;
      pinPresent.current = state.hasPin;
      setHasPin(state.hasPin);
      setBiometric(state.biometric);
      setLocked(state.hasPin && !(AppState.currentState === 'active' && consumeLoginUnlock(session)));
      setLoadError('');
    }, () => { if (active) setLoadError('Qulf ma’lumotini yuklab bo‘lmadi.'); })
      .finally(() => { if (active) setLoaded(true); });
    return () => { active = false; mounted.current = false; };
  }, [session]);

  useEffect(() => {
    const listener = AppState.addEventListener('change', state => {
      if (authenticating.current) {
        if (state === 'background' && pinPresent.current) { lifecycleEpoch.current++; wasInactive.current = true; setShield(true); }
        return;
      }
      if (state === 'inactive' || state === 'background') {
        if (pinPresent.current) { lifecycleEpoch.current++; wasInactive.current = true; setShield(true); }
      } else if (state === 'active' && wasInactive.current) {
        wasInactive.current = false;
        setLocked(pinPresent.current);
        setShield(false);
        setInput('');
        setError('');
      }
    });
    return () => listener.remove();
  }, []);

  const savePin = useCallback(async (pin: string) => {
    await saveAppPin(session, pin);
    if (mounted.current) {
      pinPresent.current = true;
      setHasPin(true);
      if (AppState.currentState !== 'active') { wasInactive.current = true; setShield(true); }
    }
  }, [session]);

  const removePin = useCallback(async () => {
    await clearAppLock(session);
    if (mounted.current) { pinPresent.current = false; setHasPin(false); setBiometric(false); setLocked(false); setShield(false); }
  }, [session]);

  const setBiometricEnabled = useCallback(async (enabled: boolean) => {
    if (authenticating.current) throw new Error('Biometrik tasdiq davom etmoqda.');
    authenticating.current = true;
    try {
      await setAppBiometric(session, enabled);
      if (mounted.current) setBiometric(enabled);
    } finally {
      authenticating.current = false;
      if (wasInactive.current && AppState.currentState === 'active' && mounted.current) {
        wasInactive.current = false;
        setLocked(pinPresent.current);
        setShield(false);
      }
    }
  }, [session]);

  const unlock = async () => {
    if (unlocking.current) return;
    unlocking.current = true;
    const startedAt = lifecycleEpoch.current;
    setBusy(true);
    try {
      const ok = await verifyAppPin(session, input);
      if (!mounted.current) return;
      if (startedAt !== lifecycleEpoch.current || AppState.currentState !== 'active') return;
      if (ok) { setLocked(false); setInput(''); setError(''); }
      else { setInput(''); setError(text('pinWrong')); }
    } catch { if (mounted.current) setError(text('pinWrong')); }
    finally { unlocking.current = false; if (mounted.current) setBusy(false); }
  };

  const unlockBiometric = useCallback(async () => {
    if (unlocking.current || authenticating.current) return;
    unlocking.current = true;
    const startedAt = lifecycleEpoch.current;
    setBusy(true);
    authenticating.current = true;
    try {
      const ok = await unlockAppWithBiometric(session);
      if (mounted.current && startedAt === lifecycleEpoch.current && ok) { setLocked(false); setInput(''); setError(''); }
      else if (mounted.current && startedAt === lifecycleEpoch.current) setError(localizedGetter('biometricFailed', locale));
    } catch { if (mounted.current) setError(localizedGetter('biometricFailed', locale)); }
    finally {
      authenticating.current = false;
      unlocking.current = false;
      if (mounted.current) {
        if (wasInactive.current && AppState.currentState === 'active') {
          wasInactive.current = false;
          setLocked(pinPresent.current);
          setShield(false);
        }
        setBusy(false);
      }
    }
  }, [session, locale]);

  useEffect(() => {
    if (!locked || shield) { autoBiometricAttempted.current = false; return; }
    if (!biometric || !biometricAvailable() || autoBiometricAttempted.current || AppState.currentState !== 'active') return;
    autoBiometricAttempted.current = true;
    const timer = setTimeout(() => { void unlockBiometric(); }, 350);
    return () => clearTimeout(timer);
  }, [locked, shield, biometric, unlockBiometric]);

  const bg = dark ? '#000000' : '#f2f2f7';
  const foreground = dark ? '#ffffff' : '#1c1c1e';
  const value: Security = { hasPin, biometric, canUseBiometric: biometricAvailable(), savePin, removePin, setBiometric: setBiometricEnabled };
  return <SecurityContext.Provider value={value}>
    <View style={styles.flex}>{loaded && !loadError ? children : <View style={[styles.center, { backgroundColor: bg }]}>
      {loadError ? <><Text style={[styles.message, { color: foreground }]}>{loadError}</Text>
        <Pressable accessibilityRole="button" onPress={() => { setLoaded(false); void load(); }}><Text style={styles.action}>{text('retry')}</Text></Pressable>
        <Pressable accessibilityRole="button" onPress={onLogout}><Text style={styles.action}>{text('logoutTitle')}</Text></Pressable></> : <ActivityIndicator />}
    </View>}</View>
    <Modal visible={loaded && !loadError && (locked || shield)} animationType="fade" presentationStyle="fullScreen" onRequestClose={() => {}}>
      <View style={[styles.center, { backgroundColor: bg }]}>
        {locked && !shield ? <>
          <Text style={[styles.title, { color: foreground }]}>{text('appLockTitle')}</Text>
          <Text style={[styles.message, { color: foreground }]}>{text('appLockSubtitle')}</Text>
          <TextInput value={input} onChangeText={value => setInput(value.replace(/\D/g, '').slice(0, 4))} keyboardType="number-pad"
            secureTextEntry maxLength={4} accessibilityLabel="PIN kod" style={[styles.input, { color: foreground, borderColor: dark ? '#636366' : '#c7c7cc' }]} />
          {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
          <Pressable accessibilityRole="button" disabled={busy} onPress={() => { void unlock(); }} style={styles.button}>
            <Text style={styles.buttonText}>{text(busy ? 'checking' : 'unlock')}</Text>
          </Pressable>
          {biometric && biometricAvailable() ? <Pressable accessibilityRole="button" disabled={busy} onPress={() => { void unlockBiometric(); }}>
            <Text style={styles.action}>{text('biometricCta')}</Text>
          </Pressable> : null}
          <Pressable accessibilityRole="button" onPress={() => Alert.alert(text('logoutTitle'), text('logoutPrompt'), [
            { text: text('no'), style: 'cancel' }, { text: text('logoutTitle'), style: 'destructive', onPress: onLogout },
          ])}><Text style={styles.action}>{text('logoutTitle')}</Text></Pressable>
        </> : null}
      </View>
    </Modal>
  </SecurityContext.Provider>;
}

const styles = StyleSheet.create({
  flex: { flex: 1 }, center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 18 },
  title: { fontSize: 24, fontWeight: '700' }, message: { fontSize: 16, textAlign: 'center' },
  input: { width: 180, borderWidth: 1, borderRadius: 14, fontSize: 24, textAlign: 'center', letterSpacing: 8, padding: 12 },
  button: { backgroundColor: '#007aff', paddingHorizontal: 32, paddingVertical: 13, borderRadius: 22 }, buttonText: { color: '#fff', fontWeight: '600', fontSize: 16 },
  action: { color: '#007aff', fontSize: 16 }, error: { color: '#ff453a', textAlign: 'center' },
});
