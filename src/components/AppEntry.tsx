import { BottomSheet, Button, FieldGroup, ListItem, RNHostView, Text, TextInput, useNativeState } from '@expo/ui';
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
import { savedAccountDisplayName, savedAccountSubtitle } from '../shared/accountEntryLogic';
import { BaseHost as Host } from './BaseHost';
import { WelcomeScreen } from './WelcomeScreen';
import { useBaseTheme } from './useBaseTheme';

const subscribeLocale = (listener: () => void) => localeController.addListener(listener);
const localeSnapshot = () => localeController.locale;
// @v2 AppEntryScreen
// @v2 AccountSwitcherSheet
// @v2 WelcomeScreen
// @v2 _SelectionSheet
export function AppEntry({ onLogin }: { onLogin: (session: Session) => void }) {
  const locale = useSyncExternalStore(subscribeLocale, localeSnapshot, localeSnapshot);
  const theme = useBaseTheme();
  const text = (key: string) => localizedGetter(key, locale);
  const [accounts, setAccounts] = useState<SavedAccount[] | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [pinPresence, setPinPresence] = useState<Record<string, boolean>>({});
  const [page, setPage] = useState<'welcome' | 'accounts' | 'login' | 'languages'>('welcome');
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
    timer = setTimeout(advance, 5000);
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
      void Promise.all(saved.map(async account => [account.id,
        await switchPinStore.has({ baseUrl: account.base_url, profile: account.profile }).catch(() => false)] as const))
        .then(values => { if (active) setPinPresence(Object.fromEntries(values)); });
    }, () => { if (active) setAccounts([]); });
    return () => { active = false; };
  }, []);

  const back = () => {
    if (pending.current) return;
    setError('');
    if (target) { setTarget(null); pin.current = ''; pinField.set(''); }
    else if (page === 'login') { setHeadlineIndex(0); setPage(accounts?.length ? 'accounts' : 'welcome'); }
    else if (page === 'languages') setPage('welcome');
  };
  useEffect(() => {
    if (Platform.OS !== 'android' || (page !== 'login' && !target && page !== 'languages')) return;
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
  const welcomeLocale = explicitLocale ? locale : ['uz', 'en', 'ru', 'ur-PK'][headlineIndex];
  const welcomeText = (key: string) => localizedGetter(key, welcomeLocale);
  const languageKey = ({ uz: 'uzbek', en: 'english', ru: 'russian' } as Record<string, string>)[locale.split('-')[0]] ?? 'uzbek';
  return <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.surfaceContainerLow }}>
    {page === 'welcome' || page === 'languages' ? <WelcomeScreen
      headline={welcomeText('welcomeToAccord')} languageLabel={welcomeText('languageTitle')}
      languageValue={explicitLocale ? locale.startsWith('ur') ? 'اردو (پاکستان)' : welcomeText(languageKey) : welcomeText('languageUnselected')}
      startLabel={welcomeText('getStarted')} onStart={() => setPage('login')} onLanguage={() => setPage('languages')} /> : null}
    {page === 'accounts' ? <Host style={{ flex: 1 }}><FieldGroup>
    <FieldGroup.Section title={text('accountSwitchTitle')}>
      {target ? <>
        <Text>{localizedMethod('accountPinPrompt', locale, { name: savedAccountDisplayName(target) })}</Text>
        <TextInput value={pinField} accessibilityLabel="PIN" placeholder="PIN" keyboardType="number-pad" secureTextEntry
          editable={!busy} onChangeText={value => { const next = value.replace(/\D/g, '').slice(0, 4); pin.current = next; if (next !== value) pinField.set(next); }}
          onSubmitEditing={() => { void verify(); }} />
        <Button label={text(busy ? 'checking' : 'unlock')} disabled={busy} onPress={() => { void verify(); }} />
        <Button label={text('closeAction')} disabled={busy} onPress={back} />
      </> : <>
        {accounts.map(account => <ListItem key={account.id} supportingText={savedAccountSubtitle(account)}
          leading={<Text>{savedAccountDisplayName(account).charAt(0).toUpperCase() || '?'}</Text>}
          trailing={<Text>{`${pinPresence[account.id] ? '🔒 ' : ''}${account.id === activeId ? text('accountCurrent') : ''}`}</Text>}
          onPress={busy || account.id === activeId ? undefined : () => { void select(account); }}>
          {savedAccountDisplayName(account)}</ListItem>)}
        <Button label={text('accountAdd')} disabled={busy} onPress={() => setPage('login')} />
      </>}
      {error ? <Text textStyle={{ color: '#b3261e' }}>{error}</Text> : null}
    </FieldGroup.Section>
  </FieldGroup></Host> : null}
  <BottomSheet isPresented={page === 'languages'} onDismiss={() => setPage('welcome')} snapPoints={['half', 'full']}>
    <RNHostView matchContents={{ vertical: true }}>
    <Host style={{ width: '100%', height: 420 }}><FieldGroup>
    {page === 'languages' ? <FieldGroup.Section title={text('languageTitle')}>
      {[{ id: 'uz', label: text('uzbek') }, { id: 'en', label: text('english') },
        { id: 'ru', label: text('russian') }, { id: 'ur', label: 'اردو (پاکستان)' }].map(choice =>
        <Button key={choice.id} label={`${choice.label}${locale.split('-')[0] === choice.id ? ` · ${text('accountCurrent')}` : ''}`}
          onPress={() => { void localeController.setLocale(choice.id); setPage('welcome'); }} />)}
      <Button label={text('closeAction')} onPress={back} />
    </FieldGroup.Section> : null}
    </FieldGroup></Host>
    </RNHostView>
  </BottomSheet></SafeAreaView>;
}
