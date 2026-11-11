import { Button, Column, OutlinedButton, OutlinedTextField, Row, Switch, Text, TextButton } from '@expo/ui/jetpack-compose';
import { fillMaxWidth, padding, semantics, testID, verticalScroll, weight } from '@expo/ui/jetpack-compose/modifiers';
import Constants from 'expo-constants';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Alert, BackHandler } from 'react-native';
import type { AppearancePreference } from '../appAppearance';
import type { Session } from '../auth';
import { useNativeSheet } from '../nativeSheet';
import { localizedGetter } from '../shared/localization';
import { localeController } from '../shared/localization/runtime';
import type { AppThemeVariant } from '../shared/themeController';
import { themeController } from '../shared/themeRuntime';
import { useAppSettings } from './AppSettings';
import { usePinSetup } from './usePinSetup.android';
import { useSwitchPinSetup } from './useSwitchPinSetup.android';
import { BaseHost as Host } from './BaseHost';
import { useAppUpdate } from './AppUpdateProvider';

type Props = { session: Session; onClose: () => void; onLogout: () => void };
const subscribeLocale = (listener: () => void) => localeController.addListener(listener);
const currentLocale = () => localeController.locale;
const subscribeTheme = (listener: () => void) => themeController.addListener(listener);
const currentVariant = () => themeController.variant;
const appearanceChoices: { id: AppearancePreference; label: string }[] = [
  { id: 'system', label: 'Auto' }, { id: 'light', label: 'Yorug‘' }, { id: 'dark', label: 'Qorong‘i' },
];

// @v2 _ProfileSettingsSheet
// @v2 _ProfileSelectionSheet
export function ProfileSettings({ session, onClose, onLogout }: Props) {
  const locale = useSyncExternalStore(subscribeLocale, currentLocale, currentLocale);
  const variant = useSyncExternalStore(subscribeTheme, currentVariant, currentVariant);
  const t = (key: string) => localizedGetter(key, locale);
  const dynamicColors = session.profile.role === 'tayyorlov_masteri';
  const { appearance, setAppearance } = useAppSettings();
  const pin = usePinSetup();
  const switchPin = useSwitchPinSetup(session);
  const openUpdate = useAppUpdate();
  const [biometricBusy, setBiometricBusy] = useState(false);
  const biometricPending = useRef(false);
  const selectionSheet = useNativeSheet();
  useEffect(() => {
    if (!pin.mode && !switchPin.stage) return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (pin.mode) pin.back(); else switchPin.back();
      return true;
    });
    return () => subscription.remove();
  });

  const setBiometric = async (enabled: boolean) => {
    if (biometricPending.current) return;
    biometricPending.current = true;
    setBiometricBusy(true);
    try { await pin.security.setBiometric(enabled); }
    catch { Alert.alert(t(enabled ? 'biometricEnableFailed' : 'biometricDisableFailed')); }
    finally { biometricPending.current = false; setBiometricBusy(false); }
  };

  const submitPin = async () => {
    const setting = pin.mode === 'set';
    const saved = await pin.submit();
    if (saved && setting && pin.security.canUseBiometric && !pin.security.biometric) {
      Alert.alert(t('biometricQuickUnlockTitle'), t('biometricQuickUnlockPrompt'), [
        { text: t('no'), style: 'cancel' },
        { text: t('yes'), onPress: () => { void setBiometric(true); } },
      ]);
    }
  };

  const chooseLanguage = () => {
    const choices = [
      { id: 'uz', label: t('uzbek') }, { id: 'en', label: t('english') },
      { id: 'ru', label: t('russian') }, { id: 'ur-PK', label: 'اردو (پاکستان)' },
    ];
    selectionSheet.open(<Host dynamicColors={dynamicColors} style={{ flex: 1 }}><Column verticalArrangement={{ spacedBy: 8 }} modifiers={[verticalScroll(), padding(12, 12, 12, 24)]}>
      <Text style={{ typography: 'titleLarge' }}>{t('languageTitle')}</Text>
      <Text>{t('languageBody')}</Text>
      {choices.map(choice => <TextButton key={choice.id} onClick={() => {
        selectionSheet.close();
        void localeController.setLocale(choice.id).catch(() => Alert.alert('Saqlab bo‘lmadi'));
      }} modifiers={[fillMaxWidth()]}><Text>{choice.label}{locale === choice.id ? ` · ${t('accountCurrent')}` : ''}</Text></TextButton>)}
    </Column></Host>, { dismissible: true });
  };

  const chooseAppearance = () => {
    selectionSheet.open(<Host dynamicColors={dynamicColors} style={{ flex: 1 }}><Column verticalArrangement={{ spacedBy: 8 }} modifiers={[verticalScroll(), padding(12, 12, 12, 24)]}>
      <Text style={{ typography: 'titleLarge' }}>{t('themeModeTitle')}</Text>
      {appearanceChoices.map(choice => <TextButton key={choice.id} onClick={() => {
        selectionSheet.close();
        void setAppearance(choice.id).catch(() => Alert.alert('Saqlab bo‘lmadi'));
      }} modifiers={[fillMaxWidth(), testID(`profile-appearance-${choice.id}`)]}>
        <Text>{choice.label}{appearance === choice.id ? ` · ${t('accountCurrent')}` : ''}</Text>
      </TextButton>)}
    </Column></Host>, { dismissible: true });
  };

  const chooseTheme = () => {
    const choices: { id: AppThemeVariant; label: string }[] = [
      { id: 'kalmar', label: t('themeKalmarLabel') }, { id: 'classic', label: t('themeClassicLabel') },
      { id: 'moss', label: t('themeMossLabel') }, { id: 'lavender', label: t('themeLavenderLabel') },
      { id: 'bliss', label: t('themeBlissLabel') }, { id: 'white', label: t('themeWhiteLabel') },
    ];
    selectionSheet.open(<Host dynamicColors={dynamicColors} style={{ flex: 1 }}><Column verticalArrangement={{ spacedBy: 8 }} modifiers={[verticalScroll(), padding(12, 12, 12, 24)]}>
      <Text style={{ typography: 'titleLarge' }}>{t('themeTitle')}</Text>
      <Text>{t('themeBody')}</Text>
      {choices.map(choice => <TextButton key={choice.id} onClick={() => {
        selectionSheet.close();
        void themeController.setVariant(choice.id).catch(() => Alert.alert('Saqlab bo‘lmadi'));
      }} modifiers={[fillMaxWidth()]}><Text>{choice.label}{variant === choice.id ? ` · ${t('accountCurrent')}` : ''}</Text></TextButton>)}
    </Column></Host>, { dismissible: true });
  };

  return <Column verticalArrangement={{ spacedBy: 14 }} modifiers={[verticalScroll(), padding(12, 12, 12, 24)]}>
    <Text style={{ typography: 'titleLarge' }}>{t('profileSettingsTitle')}</Text>
    <Text>{t('profileSettingsBody')}</Text>
    <TextButton onClick={chooseLanguage} modifiers={[fillMaxWidth(), testID('profile-language')]}><Text>{t('languageTitle')}</Text></TextButton>
    <Text>{t('languageBody')}</Text>
    <Row verticalAlignment="center" modifiers={[fillMaxWidth()]}>
      <Column modifiers={[weight(1)]}><Text>{t('themeModeTitle')}</Text><Text>{t('themeModeBody')}</Text></Column>
      <TextButton onClick={chooseAppearance} modifiers={[testID('profile-appearance'), semantics({ contentDescription: t('themeModeTitle') })]}>
        <Text>{appearanceChoices.find(choice => choice.id === appearance)?.label}</Text>
      </TextButton>
    </Row>
    <TextButton onClick={chooseTheme} modifiers={[fillMaxWidth(), testID('profile-theme')]}><Text>{t('themeTitle')}</Text></TextButton>
    <Text>{t('themeBody')}</Text>
    <Text style={{ typography: 'titleLarge' }}>{t('securityTitle')}</Text>
    <Text>{t('appLockPinTitle')}</Text><Text>{t('appLockPinBody')}</Text>
    {!pin.mode ? <>
      <Button enabled={!pin.busy} onClick={() => pin.open('set')} modifiers={[fillMaxWidth(), testID('profile-pin-set')]}>
        <Text>{t(pin.security.hasPin ? 'pinChange' : 'pinSet')}</Text>
      </Button>
      {pin.security.hasPin ? <OutlinedButton enabled={!pin.busy} onClick={() => { void pin.remove(); }} modifiers={[fillMaxWidth()]}><Text>{t('pinRemove')}</Text></OutlinedButton> : null}
      <Row verticalAlignment="center" modifiers={[fillMaxWidth()]}>
        <Column modifiers={[weight(1)]}><Text>{t('biometricEnableTitle')}</Text><Text>{t(pin.security.biometric ? 'biometricEnabledBody' : 'biometricDisabledBody')}</Text></Column>
        <Switch value={pin.security.biometric} enabled={pin.security.hasPin && !biometricBusy} onCheckedChange={enabled => { void setBiometric(enabled); }}
          modifiers={[semantics({ contentDescription: t('biometricEnableTitle') })]} />
      </Row>
    </> : <>
      {pin.mode === 'set' && pin.phase === 'entry' ? <>
        <OutlinedTextField value={pin.pin} enabled={!pin.busy} singleLine maxLength={4} visualTransformation="password"
          keyboardOptions={{ keyboardType: 'numberPassword' }} onValueChange={value => pin.change('pin', value)} modifiers={[fillMaxWidth()]}>
          <OutlinedTextField.Label><Text>{t('pinEnterTitle')}</Text></OutlinedTextField.Label></OutlinedTextField>
      </> : null}
      {pin.mode === 'set' && pin.phase === 'confirm' ? <>
        <OutlinedTextField value={pin.repeat} enabled={!pin.busy} singleLine maxLength={4} visualTransformation="password"
          keyboardOptions={{ keyboardType: 'numberPassword' }} onValueChange={value => pin.change('repeat', value)} modifiers={[fillMaxWidth()]}>
          <OutlinedTextField.Label><Text>{t('pinRepeatTitle')}</Text></OutlinedTextField.Label></OutlinedTextField>
      </> : null}
      {pin.phaseError ? <Text>{pin.phaseError}</Text> : null}
      {pin.phase === 'entry' ? <Button enabled={!pin.busy && pin.canNext} onClick={pin.next} modifiers={[fillMaxWidth()]}><Text>{t('nextItemAction')}</Text></Button> :
        <Button enabled={!pin.busy} onClick={() => { void submitPin(); }} modifiers={[fillMaxWidth(), testID('profile-pin-save')]}><Text>{t(pin.busy ? 'pinSaving' : 'save')}</Text></Button>}
      <TextButton enabled={!pin.busy} onClick={pin.back}><Text>{t('no')}</Text></TextButton>
    </>}
    <Text>{t('switchPinTitle')}</Text><Text>{t('switchPinBody')}</Text>
    {!switchPin.stage ? <>
      <Button enabled={!switchPin.busy && switchPin.hasPin !== null} onClick={switchPin.open} modifiers={[fillMaxWidth()]}>
        <Text>{t(switchPin.hasPin ? 'switchPinChange' : 'switchPinSet')}</Text></Button>
      {switchPin.hasPin ? <OutlinedButton enabled={!switchPin.busy} onClick={() => { void switchPin.remove(); }} modifiers={[fillMaxWidth()]}><Text>{t('switchPinRemove')}</Text></OutlinedButton> : null}
    </> : <>
      <OutlinedTextField value={switchPin.field} enabled={!switchPin.busy} singleLine maxLength={4} visualTransformation="password"
        keyboardOptions={{ keyboardType: 'numberPassword' }} onValueChange={switchPin.change} modifiers={[fillMaxWidth()]}>
        <OutlinedTextField.Label><Text>{t(switchPin.stage === 'entry' ? 'switchPinEnterTitle' : 'switchPinRepeatTitle')}</Text></OutlinedTextField.Label></OutlinedTextField>
      {switchPin.error ? <Text>{switchPin.error}</Text> : null}
      <Button enabled={!switchPin.busy} onClick={() => { void switchPin.submit(); }} modifiers={[fillMaxWidth()]}>
        <Text>{t(switchPin.stage === 'entry' ? 'nextItemAction' : 'save')}</Text></Button>
      <TextButton enabled={!switchPin.busy} onClick={switchPin.back}><Text>{t('no')}</Text></TextButton>
    </>}
    <TextButton onClick={openUpdate} modifiers={[fillMaxWidth()]}><Text>{t('appUpdateSettingsTitle')}</Text></TextButton>
    <Text>{t('appUpdateSettingsBody')}</Text>
    <Text>{`Versiya: ${Constants.expoConfig?.version ?? '—'}`}</Text>
    <TextButton onClick={onLogout} modifiers={[fillMaxWidth(), testID('profile-disconnect')]}><Text>{t('disconnectSessionTitle')}</Text></TextButton>
    <Text>{t('disconnectSessionBody')}</Text>
    <TextButton enabled={!pin.busy && !switchPin.busy && !biometricBusy} onClick={onClose}><Text>{t('closeAction')}</Text></TextButton>
  </Column>;
}
