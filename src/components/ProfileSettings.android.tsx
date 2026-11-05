import { Button, Column, Host, OutlinedButton, OutlinedTextField, Row, Switch, Text, TextButton } from '@expo/ui/jetpack-compose';
import { fillMaxWidth, padding, semantics, testID, verticalScroll, weight } from '@expo/ui/jetpack-compose/modifiers';
import Constants from 'expo-constants';
import { useRef, useState, useSyncExternalStore } from 'react';
import { Alert } from 'react-native';
import { useNativeSheet } from '../nativeSheet';
import { localizedGetter } from '../shared/localization';
import { localeController } from '../shared/localization/runtime';
import type { AppThemeVariant } from '../shared/themeController';
import { themeController } from '../shared/themeRuntime';
import { useAppSettings } from './AppSettings';
import { usePinSetup } from './usePinSetup.android';

type Props = { onClose: () => void; onLogout: () => void };
const subscribeLocale = (listener: () => void) => localeController.addListener(listener);
const currentLocale = () => localeController.locale;
const subscribeTheme = (listener: () => void) => themeController.addListener(listener);
const currentVariant = () => themeController.variant;
const currentThemeMode = () => themeController.themeMode;

// @v2 _ProfileSettingsSheet
// @v2 _ProfileSelectionSheet
export function ProfileSettings({ onClose, onLogout }: Props) {
  const locale = useSyncExternalStore(subscribeLocale, currentLocale, currentLocale);
  const variant = useSyncExternalStore(subscribeTheme, currentVariant, currentVariant);
  const themeMode = useSyncExternalStore(subscribeTheme, currentThemeMode, currentThemeMode);
  const t = (key: string) => localizedGetter(key, locale);
  const { setAppearance } = useAppSettings();
  const pin = usePinSetup();
  const [biometricBusy, setBiometricBusy] = useState(false);
  const biometricPending = useRef(false);
  const selectionSheet = useNativeSheet();

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
    selectionSheet.open(<Host style={{ flex: 1 }}><Column verticalArrangement={{ spacedBy: 8 }} modifiers={[verticalScroll(), padding(12, 12, 12, 24)]}>
      <Text style={{ typography: 'titleLarge' }}>{t('languageTitle')}</Text>
      <Text>{t('languageBody')}</Text>
      {choices.map(choice => <TextButton key={choice.id} onClick={() => {
        selectionSheet.close();
        void localeController.setLocale(choice.id).catch(() => Alert.alert('Saqlab bo‘lmadi'));
      }} modifiers={[fillMaxWidth()]}><Text>{choice.label}{locale === choice.id ? ` · ${t('accountCurrent')}` : ''}</Text></TextButton>)}
    </Column></Host>, { dismissible: true });
  };

  const chooseTheme = () => {
    const choices: { id: AppThemeVariant; label: string }[] = [
      { id: 'kalmar', label: t('themeKalmarLabel') }, { id: 'classic', label: t('themeClassicLabel') },
      { id: 'moss', label: t('themeMossLabel') }, { id: 'lavender', label: t('themeLavenderLabel') },
      { id: 'bliss', label: t('themeBlissLabel') }, { id: 'white', label: t('themeWhiteLabel') },
    ];
    selectionSheet.open(<Host style={{ flex: 1 }}><Column verticalArrangement={{ spacedBy: 8 }} modifiers={[verticalScroll(), padding(12, 12, 12, 24)]}>
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
      <Switch value={themeMode === 'dark'} onCheckedChange={enabled => {
        const mode = enabled ? 'dark' : 'light';
        void Promise.all([themeController.setThemeMode(mode), setAppearance(mode)]).catch(() => Alert.alert('Saqlab bo‘lmadi'));
      }} modifiers={[semantics({ contentDescription: t('themeModeTitle') })]} />
    </Row>
    <TextButton onClick={chooseTheme} modifiers={[fillMaxWidth(), testID('profile-theme')]}><Text>{t('themeTitle')}</Text></TextButton>
    <Text>{t('themeBody')}</Text>
    <Text style={{ typography: 'titleLarge' }}>{t('securityTitle')}</Text>
    <Text>{t('appLockPinTitle')}</Text><Text>{t('appLockPinBody')}</Text>
    {!pin.mode ? <>
      <Button enabled={!pin.busy} onClick={() => pin.open('set')} modifiers={[fillMaxWidth(), testID('profile-pin-set')]}>
        <Text>{t(pin.security.hasPin ? 'pinChange' : 'pinSet')}</Text>
      </Button>
      {pin.security.hasPin ? <OutlinedButton enabled={!pin.busy} onClick={() => pin.open('remove')} modifiers={[fillMaxWidth()]}><Text>{t('pinRemove')}</Text></OutlinedButton> : null}
      <Row verticalAlignment="center" modifiers={[fillMaxWidth()]}>
        <Column modifiers={[weight(1)]}><Text>{t('biometricEnableTitle')}</Text><Text>{t(pin.security.biometric ? 'biometricEnabledBody' : 'biometricDisabledBody')}</Text></Column>
        <Switch value={pin.security.biometric} enabled={pin.security.hasPin && !biometricBusy} onCheckedChange={enabled => { void setBiometric(enabled); }}
          modifiers={[semantics({ contentDescription: t('biometricEnableTitle') })]} />
      </Row>
    </> : <>
      {pin.security.hasPin ? <OutlinedTextField value={pin.current} enabled={!pin.busy} singleLine maxLength={4} visualTransformation="password"
        keyboardOptions={{ keyboardType: 'numberPassword' }} onValueChange={value => pin.change('current', value)} modifiers={[fillMaxWidth()]}>
        <OutlinedTextField.Label><Text>Joriy PIN</Text></OutlinedTextField.Label></OutlinedTextField> : null}
      {pin.mode === 'set' ? <>
        <OutlinedTextField value={pin.pin} enabled={!pin.busy} singleLine maxLength={4} visualTransformation="password"
          keyboardOptions={{ keyboardType: 'numberPassword' }} onValueChange={value => pin.change('pin', value)} modifiers={[fillMaxWidth()]}>
          <OutlinedTextField.Label><Text>{t('pinEnterTitle')}</Text></OutlinedTextField.Label></OutlinedTextField>
        <OutlinedTextField value={pin.repeat} enabled={!pin.busy} singleLine maxLength={4} visualTransformation="password"
          keyboardOptions={{ keyboardType: 'numberPassword' }} onValueChange={value => pin.change('repeat', value)} modifiers={[fillMaxWidth()]}>
          <OutlinedTextField.Label><Text>{t('pinRepeatTitle')}</Text></OutlinedTextField.Label></OutlinedTextField>
      </> : null}
      <Button enabled={!pin.busy} onClick={() => { void submitPin(); }} modifiers={[fillMaxWidth(), testID('profile-pin-save')]}>
        <Text>{t(pin.busy ? 'pinSaving' : pin.mode === 'remove' ? 'pinRemove' : 'save')}</Text>
      </Button>
      <TextButton enabled={!pin.busy} onClick={pin.close}><Text>{t('no')}</Text></TextButton>
    </>}
    <Text>{`Versiya: ${Constants.expoConfig?.version ?? '—'}`}</Text>
    <TextButton onClick={onLogout} modifiers={[fillMaxWidth(), testID('profile-disconnect')]}><Text>{t('disconnectSessionTitle')}</Text></TextButton>
    <Text>{t('disconnectSessionBody')}</Text>
    <TextButton enabled={!pin.busy && !biometricBusy} onClick={onClose}><Text>{t('closeAction')}</Text></TextButton>
  </Column>;
}
