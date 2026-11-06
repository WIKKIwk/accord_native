import { Button, FieldGroup, Text, TextInput, useNativeState } from '@expo/ui';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { ActivityIndicator, BackHandler, Platform, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { createRuntimeAccountSwitchController, loadSession, type Session } from '../auth';
import { LoginScreen } from '../LoginScreen';
import { MobileApi } from '../mobileApi';
import { initializeSavedAccounts } from '../savedAccountRuntime';
import type { SavedAccount } from '../savedAccountStore';
import { localizedGetter, localizedMethod } from '../shared/localization';
import { localeController } from '../shared/localization/runtime';
import { switchPinStore } from '../shared/switchPinRuntime';
import type { AppThemeVariant } from '../shared/themeController';
import { themeController } from '../shared/themeRuntime';
import { BaseHost as Host } from './BaseHost';

const subscribeLocale = (listener: () => void) => localeController.addListener(listener);
const localeSnapshot = () => localeController.locale;
const subscribeTheme = (listener: () => void) => themeController.addListener(listener);
const themeSnapshot = () => `${themeController.variant}:${themeController.themeMode}`;
const themes: { value: AppThemeVariant; label: string }[] = [
  { value: 'kalmar', label: 'themeKalmarLabel' }, { value: 'classic', label: 'themeClassicLabel' },
  { value: 'moss', label: 'themeMossLabel' }, { value: 'lavender', label: 'themeLavenderLabel' },
  { value: 'bliss', label: 'themeBlissLabel' }, { value: 'white', label: 'themeWhiteLabel' },
];

function accountName(account: SavedAccount): string {
  return String(account.profile.display_name || account.profile.legal_name || account.profile.ref || '').trim();
}

// @v2 AppEntryScreen
// @v2 AccountSwitcherSheet
// @v2 WelcomeScreen
export function AppEntry({ onLogin }: { onLogin: (session: Session) => void }) {
  const locale = useSyncExternalStore(subscribeLocale, localeSnapshot, localeSnapshot);
  useSyncExternalStore(subscribeTheme, themeSnapshot, themeSnapshot);
  const text = (key: string) => localizedGetter(key, locale);
  const [accounts, setAccounts] = useState<SavedAccount[] | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [page, setPage] = useState<'welcome' | 'accounts' | 'login' | 'languages' | 'themes'>('welcome');
  const [headlineIndex, setHeadlineIndex] = useState(0);
  const [target, setTarget] = useState<SavedAccount | null>(null);
  const pin = useRef('');
  const pinField = useNativeState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const pending = useRef(false);
  const explicitLocale = localeController.hasExplicitSelection;

  useEffect(() => {
    if (page !== 'welcome' || explicitLocale) return;
    let timer: ReturnType<typeof setTimeout>;
    const advance = () => { setHeadlineIndex(index => (index + 1) % 4); timer = setTimeout(advance, 5790); };
    timer = setTimeout(advance, 5300);
    return () => clearTimeout(timer);
  }, [page, explicitLocale]);

  useEffect(() => {
    let active = true;
    void initializeSavedAccounts(MobileApi.instance.baseUrl).then(store => {
      if (!active) return;
      const saved = store.accountsForEndpoint(MobileApi.instance.baseUrl);
      setAccounts(saved);
      setActiveId(store.activeAccountId);
      setPage(saved.length ? 'accounts' : 'welcome');
    }, () => { if (active) setAccounts([]); });
    return () => { active = false; };
  }, []);

  const back = () => {
    if (pending.current) return;
    setError('');
    if (target) { setTarget(null); pin.current = ''; pinField.set(''); }
    else if (page === 'login') { setHeadlineIndex(0); setPage(accounts?.length ? 'accounts' : 'welcome'); }
    else if (page === 'languages' || page === 'themes') setPage('welcome');
  };
  useEffect(() => {
    if (Platform.OS !== 'android' || (page !== 'login' && !target && page !== 'languages' && page !== 'themes')) return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => { back(); return true; });
    return () => subscription.remove();
  });

  const runSwitch = async (account: SavedAccount) => {
    const controller = await createRuntimeAccountSwitchController(account.base_url);
    await controller.switchTo(account.id);
    const session = await loadSession();
    if (!session) throw new Error('Account session is unavailable');
    onLogin(session);
  };
  const select = async (account: SavedAccount) => {
    if (pending.current || account.id === activeId) return;
    pending.current = true; setBusy(true); setError('');
    try {
      if (await switchPinStore.has({ baseUrl: account.base_url, profile: account.profile })) {
        setTarget(account); pin.current = ''; pinField.set('');
      } else await runSwitch(account);
    } catch { setError(text('accountSwitchFailed')); }
    finally { pending.current = false; setBusy(false); }
  };
  const verify = async () => {
    if (!target || pending.current) return;
    pending.current = true; setBusy(true); setError('');
    try {
      if (!await switchPinStore.verify({ baseUrl: target.base_url, profile: target.profile }, pin.current)) {
        pin.current = ''; pinField.set(''); setError(text('pinWrong')); return;
      }
      await runSwitch(target);
    } catch { setError(text('accountSwitchFailed')); }
    finally { pending.current = false; setBusy(false); }
  };

  if (!accounts) return <View style={{ flex: 1, justifyContent: 'center' }}><ActivityIndicator /></View>;
  if (page === 'login') return <LoginScreen onLogin={onLogin} onBack={back} />;
  return <SafeAreaView style={{ flex: 1 }}><Host style={{ flex: 1 }}><FieldGroup>
    {page === 'accounts' ? <FieldGroup.Section title={text('accountSwitchTitle')}>
      {target ? <>
        <Text>{localizedMethod('accountPinPrompt', locale, { name: accountName(target) })}</Text>
        <TextInput value={pinField} accessibilityLabel="PIN" placeholder="PIN" keyboardType="number-pad" secureTextEntry
          editable={!busy} onChangeText={value => { const next = value.replace(/\D/g, '').slice(0, 4); pin.current = next; if (next !== value) pinField.set(next); }}
          onSubmitEditing={() => { void verify(); }} />
        <Button label={text(busy ? 'checking' : 'unlock')} disabled={busy} onPress={() => { void verify(); }} />
        <Button label={text('closeAction')} disabled={busy} onPress={back} />
      </> : <>
        {accounts.map(account => <Button key={account.id} label={`${accountName(account)}${account.id === activeId ? ` · ${text('accountCurrent')}` : ''}`}
          disabled={busy || account.id === activeId} onPress={() => { void select(account); }} />)}
        <Button label={text('accountAdd')} disabled={busy} onPress={() => setPage('login')} />
      </>}
      {error ? <Text textStyle={{ color: '#b3261e' }}>{error}</Text> : null}
    </FieldGroup.Section> : null}
    {page === 'welcome' ? <FieldGroup.Section title="Accord">
      <Text>{localizedGetter('welcomeToAccord', explicitLocale ? locale : ['uz', 'en', 'ru', 'ur-PK'][headlineIndex])}</Text>
      <Button label={text('getStarted')} onPress={() => setPage('login')} />
      <Button label={text('languageTitle')} onPress={() => setPage('languages')} />
      <Button label={text('themeTitle')} onPress={() => setPage('themes')} />
    </FieldGroup.Section> : null}
    {page === 'languages' ? <FieldGroup.Section title={text('languageTitle')}>
      {[{ id: 'uz', label: text('uzbek') }, { id: 'en', label: text('english') },
        { id: 'ru', label: text('russian') }, { id: 'ur', label: 'اردو (پاکستان)' }].map(choice =>
        <Button key={choice.id} label={`${choice.label}${locale.split('-')[0] === choice.id ? ` · ${text('accountCurrent')}` : ''}`}
          onPress={() => { void localeController.setLocale(choice.id); setPage('welcome'); }} />)}
      <Button label={text('closeAction')} onPress={back} />
    </FieldGroup.Section> : null}
    {page === 'themes' ? <FieldGroup.Section title={text('themeTitle')}>
      {themes.map(choice => <Button key={choice.value} label={`${text(choice.label)}${themeController.variant === choice.value ? ` · ${text('accountCurrent')}` : ''}`}
        onPress={() => { void themeController.setVariant(choice.value); setPage('welcome'); }} />)}
      <Button label={text('themeModeTitle')} onPress={() => { void themeController.setThemeMode(themeController.isDark ? 'light' : 'dark'); }} />
      <Button label={text('closeAction')} onPress={back} />
    </FieldGroup.Section> : null}
  </FieldGroup></Host></SafeAreaView>;
}
