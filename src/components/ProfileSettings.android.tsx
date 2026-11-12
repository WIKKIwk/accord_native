import { Button, Column, HorizontalDivider, Icon, IconButton, OutlinedTextField, Row, Switch, Text, TextButton, useMaterialColors } from '@expo/ui/jetpack-compose';
import { background, clip, fillMaxWidth, padding, rotate, semantics, testID, verticalScroll, weight } from '@expo/ui/jetpack-compose/modifiers';
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
  const colors = useMaterialColors();
  const dynamicColors = session.profile.role === 'tayyorlov_masteri' || session.profile.role === 'aparatchi';
  const { appearance, setAppearance } = useAppSettings();
  const pin = usePinSetup();
  const switchPin = useSwitchPinSetup(session);
  const openUpdate = useAppUpdate();
  const [biometricBusy, setBiometricBusy] = useState(false);
  const biometricPending = useRef(false);
  const selectionSheet = useNativeSheet();
  const languages = [
    { id: 'uz', label: t('uzbek') }, { id: 'en', label: t('english') },
    { id: 'ru', label: t('russian') }, { id: 'ur-PK', label: 'اردو (پاکستان)' },
  ];
  const themes: { id: AppThemeVariant; label: string }[] = [
    { id: 'kalmar', label: t('themeKalmarLabel') }, { id: 'classic', label: t('themeClassicLabel') },
    { id: 'moss', label: t('themeMossLabel') }, { id: 'lavender', label: t('themeLavenderLabel') },
    { id: 'bliss', label: t('themeBlissLabel') }, { id: 'white', label: t('themeWhiteLabel') },
  ];
  const cardModifiers = [fillMaxWidth(), clip({ type: 'roundedCorner', radius: 20 }), background(colors.surfaceContainerLow)];
  const rowPadding = { start: 16, end: 16, top: 12, bottom: 12 };
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
    selectionSheet.open(<Host dynamicColors={dynamicColors} style={{ flex: 1 }}><Column verticalArrangement={{ spacedBy: 8 }} modifiers={[verticalScroll(), padding(12, 12, 12, 24)]}>
      <Text style={{ typography: 'titleLarge' }}>{t('languageTitle')}</Text>
      <Text color={colors.onSurfaceVariant}>{t('languageBody')}</Text>
      {languages.map(choice => <TextButton key={choice.id} onClick={() => {
        selectionSheet.close();
        void localeController.setLocale(choice.id).catch(() => Alert.alert('Saqlab bo‘lmadi'));
      }} contentPadding={rowPadding} modifiers={[fillMaxWidth()]}><Row modifiers={[fillMaxWidth()]}><Text>{choice.label}{locale === choice.id ? ` · ${t('accountCurrent')}` : ''}</Text></Row></TextButton>)}
    </Column></Host>, { dismissible: true });
  };

  const chooseAppearance = () => {
    selectionSheet.open(<Host dynamicColors={dynamicColors} style={{ flex: 1 }}><Column verticalArrangement={{ spacedBy: 8 }} modifiers={[verticalScroll(), padding(12, 12, 12, 24)]}>
      <Text style={{ typography: 'titleLarge' }}>{t('themeModeTitle')}</Text>
      {appearanceChoices.map(choice => <TextButton key={choice.id} onClick={() => {
        selectionSheet.close();
        void setAppearance(choice.id).catch(() => Alert.alert('Saqlab bo‘lmadi'));
      }} contentPadding={rowPadding} modifiers={[fillMaxWidth(), testID(`profile-appearance-${choice.id}`)]}>
        <Row modifiers={[fillMaxWidth()]}><Text>{choice.label}{appearance === choice.id ? ` · ${t('accountCurrent')}` : ''}</Text></Row>
      </TextButton>)}
    </Column></Host>, { dismissible: true });
  };

  const chooseTheme = () => {
    selectionSheet.open(<Host dynamicColors={dynamicColors} style={{ flex: 1 }}><Column verticalArrangement={{ spacedBy: 8 }} modifiers={[verticalScroll(), padding(12, 12, 12, 24)]}>
      <Text style={{ typography: 'titleLarge' }}>{t('themeTitle')}</Text>
      <Text color={colors.onSurfaceVariant}>{t('themeBody')}</Text>
      {themes.map(choice => <TextButton key={choice.id} onClick={() => {
        selectionSheet.close();
        void themeController.setVariant(choice.id).catch(() => Alert.alert('Saqlab bo‘lmadi'));
      }} contentPadding={rowPadding} modifiers={[fillMaxWidth()]}><Row modifiers={[fillMaxWidth()]}><Text>{choice.label}{variant === choice.id ? ` · ${t('accountCurrent')}` : ''}</Text></Row></TextButton>)}
    </Column></Host>, { dismissible: true });
  };

  const preferenceRow = (title: string, description: string, value: string, onClick: () => void, id: string) =>
    <TextButton onClick={onClick} contentPadding={rowPadding} modifiers={[fillMaxWidth(), testID(id)]}>
      <Row verticalAlignment="center" horizontalArrangement={{ spacedBy: 10 }} modifiers={[fillMaxWidth()]}>
        <Column verticalArrangement={{ spacedBy: 3 }} modifiers={[weight(1)]}>
          <Text color={colors.onSurface} style={{ typography: 'bodyLarge', fontWeight: '500' }}>{title}</Text>
          <Text color={colors.onSurfaceVariant} style={{ typography: 'bodySmall' }}>{description}</Text>
        </Column>
        <Text color={colors.primary} style={{ typography: 'bodyMedium' }}>{value}</Text>
        <Icon source={require('../../assets/icons/gscale/expand_more.xml')} size={18} tint={colors.onSurfaceVariant} modifiers={[rotate(-90)]} />
      </Row>
    </TextButton>;
  const sectionTitle = (title: string) => <Text color={colors.onSurfaceVariant}
    style={{ typography: 'labelLarge', fontWeight: '600' }} modifiers={[padding(4, 4, 4, 0)]}>{title}</Text>;
  const divider = () => <HorizontalDivider color={colors.outlineVariant} modifiers={[padding(16, 0, 16, 0)]} />;

  return <Column verticalArrangement={{ spacedBy: 12 }} modifiers={[fillMaxWidth(), verticalScroll(), padding(16, 8, 16, 28)]}>
    <Row verticalAlignment="center" modifiers={[fillMaxWidth()]}>
      <Text color={colors.onSurface} style={{ typography: 'titleLarge', fontWeight: '600' }} modifiers={[weight(1)]}>{t('profileSettingsTitle')}</Text>
      <IconButton enabled={!pin.busy && !switchPin.busy && !biometricBusy} onClick={onClose} modifiers={[semantics({ contentDescription: t('closeAction') })]}>
        <Icon source={require('../../assets/icons/gscale/close.xml')} size={22} tint={colors.onSurfaceVariant} />
      </IconButton>
    </Row>
    <Text color={colors.onSurfaceVariant} style={{ typography: 'bodyMedium' }}>{t('profileSettingsBody')}</Text>
    <Column modifiers={cardModifiers}>
      {preferenceRow(t('languageTitle'), t('languageBody'), languages.find(choice => choice.id.split('-')[0] === locale.split('-')[0])?.label ?? '', chooseLanguage, 'profile-language')}
      {divider()}
      {preferenceRow(t('themeModeTitle'), t('themeModeBody'), appearanceChoices.find(choice => choice.id === appearance)?.label ?? '', chooseAppearance, 'profile-appearance')}
      {divider()}
      {preferenceRow(t('themeTitle'), t('themeBody'), themes.find(choice => choice.id === variant)?.label ?? '', chooseTheme, 'profile-theme')}
    </Column>
    {sectionTitle(t('securityTitle'))}
    <Column modifiers={cardModifiers}>
      <Column verticalArrangement={{ spacedBy: 4 }} modifiers={[fillMaxWidth(), padding(16, 14, 16, 4)]}>
        <Text color={colors.onSurface} style={{ typography: 'bodyLarge', fontWeight: '500' }}>{t('appLockPinTitle')}</Text>
        <Text color={colors.onSurfaceVariant} style={{ typography: 'bodySmall' }}>{t('appLockPinBody')}</Text>
      </Column>
      {!pin.mode ? <>
        <TextButton enabled={!pin.busy} onClick={() => pin.open('set')} contentPadding={rowPadding} modifiers={[fillMaxWidth(), testID('profile-pin-set')]}>
          <Row modifiers={[fillMaxWidth()]}><Text>{t(pin.security.hasPin ? 'pinChange' : 'pinSet')}</Text></Row>
        </TextButton>
        {pin.security.hasPin ? <TextButton enabled={!pin.busy} onClick={() => { void pin.remove(); }} contentPadding={rowPadding} modifiers={[fillMaxWidth()]}>
          <Row modifiers={[fillMaxWidth()]}><Text>{t('pinRemove')}</Text></Row>
        </TextButton> : null}
        {divider()}
        <Row verticalAlignment="center" horizontalArrangement={{ spacedBy: 12 }} modifiers={[fillMaxWidth(), padding(16, 12, 16, 12)]}>
          <Column verticalArrangement={{ spacedBy: 3 }} modifiers={[weight(1)]}>
            <Text color={colors.onSurface} style={{ typography: 'bodyLarge' }}>{t('biometricEnableTitle')}</Text>
            <Text color={colors.onSurfaceVariant} style={{ typography: 'bodySmall' }}>{t(pin.security.biometric ? 'biometricEnabledBody' : 'biometricDisabledBody')}</Text>
          </Column>
          <Switch value={pin.security.biometric} enabled={pin.security.hasPin && !biometricBusy} onCheckedChange={enabled => { void setBiometric(enabled); }}
            modifiers={[semantics({ contentDescription: t('biometricEnableTitle') })]} />
        </Row>
      </> : <Column verticalArrangement={{ spacedBy: 8 }} modifiers={[fillMaxWidth(), padding(16, 8, 16, 16)]}>
        {pin.mode === 'set' && pin.phase === 'entry' ? <OutlinedTextField value={pin.pin} enabled={!pin.busy} singleLine maxLength={4} visualTransformation="password"
          keyboardOptions={{ keyboardType: 'numberPassword' }} onValueChange={value => pin.change('pin', value)} modifiers={[fillMaxWidth()]}>
          <OutlinedTextField.Label><Text>{t('pinEnterTitle')}</Text></OutlinedTextField.Label></OutlinedTextField> : null}
        {pin.mode === 'set' && pin.phase === 'confirm' ? <OutlinedTextField value={pin.repeat} enabled={!pin.busy} singleLine maxLength={4} visualTransformation="password"
          keyboardOptions={{ keyboardType: 'numberPassword' }} onValueChange={value => pin.change('repeat', value)} modifiers={[fillMaxWidth()]}>
          <OutlinedTextField.Label><Text>{t('pinRepeatTitle')}</Text></OutlinedTextField.Label></OutlinedTextField> : null}
        {pin.phaseError ? <Text color={colors.error}>{pin.phaseError}</Text> : null}
        {pin.phase === 'entry' ? <Button enabled={!pin.busy && pin.canNext} onClick={pin.next} modifiers={[fillMaxWidth()]}><Text>{t('nextItemAction')}</Text></Button> :
          <Button enabled={!pin.busy} onClick={() => { void submitPin(); }} modifiers={[fillMaxWidth(), testID('profile-pin-save')]}><Text>{t(pin.busy ? 'pinSaving' : 'save')}</Text></Button>}
        <TextButton enabled={!pin.busy} onClick={pin.back}><Text>{t('no')}</Text></TextButton>
      </Column>}
    </Column>
    {sectionTitle(t('switchPinTitle'))}
    <Column modifiers={cardModifiers}>
      <Text color={colors.onSurfaceVariant} style={{ typography: 'bodySmall' }} modifiers={[fillMaxWidth(), padding(16, 14, 16, 4)]}>{t('switchPinBody')}</Text>
      {!switchPin.stage ? <>
        <TextButton enabled={!switchPin.busy && switchPin.hasPin !== null} onClick={switchPin.open} contentPadding={rowPadding} modifiers={[fillMaxWidth()]}>
          <Row modifiers={[fillMaxWidth()]}><Text>{t(switchPin.hasPin ? 'switchPinChange' : 'switchPinSet')}</Text></Row></TextButton>
        {switchPin.hasPin ? <TextButton enabled={!switchPin.busy} onClick={() => { void switchPin.remove(); }} contentPadding={rowPadding} modifiers={[fillMaxWidth()]}>
          <Row modifiers={[fillMaxWidth()]}><Text>{t('switchPinRemove')}</Text></Row></TextButton> : null}
      </> : <Column verticalArrangement={{ spacedBy: 8 }} modifiers={[fillMaxWidth(), padding(16, 8, 16, 16)]}>
        <OutlinedTextField value={switchPin.field} enabled={!switchPin.busy} singleLine maxLength={4} visualTransformation="password"
          keyboardOptions={{ keyboardType: 'numberPassword' }} onValueChange={switchPin.change} modifiers={[fillMaxWidth()]}>
          <OutlinedTextField.Label><Text>{t(switchPin.stage === 'entry' ? 'switchPinEnterTitle' : 'switchPinRepeatTitle')}</Text></OutlinedTextField.Label></OutlinedTextField>
        {switchPin.error ? <Text color={colors.error}>{switchPin.error}</Text> : null}
        <Button enabled={!switchPin.busy} onClick={() => { void switchPin.submit(); }} modifiers={[fillMaxWidth()]}>
          <Text>{t(switchPin.stage === 'entry' ? 'nextItemAction' : 'save')}</Text></Button>
        <TextButton enabled={!switchPin.busy} onClick={switchPin.back}><Text>{t('no')}</Text></TextButton>
      </Column>}
    </Column>
    {sectionTitle(t('appTitle'))}
    <Column modifiers={cardModifiers}>
      <TextButton onClick={openUpdate} contentPadding={rowPadding} modifiers={[fillMaxWidth()]}><Row modifiers={[fillMaxWidth()]}>
        <Column verticalArrangement={{ spacedBy: 3 }}><Text>{t('appUpdateSettingsTitle')}</Text>
          <Text color={colors.onSurfaceVariant} style={{ typography: 'bodySmall' }}>{t('appUpdateSettingsBody')}</Text></Column>
      </Row></TextButton>
      {divider()}
      <Row verticalAlignment="center" modifiers={[fillMaxWidth(), padding(16, 14, 16, 14)]}>
        <Text color={colors.onSurface} modifiers={[weight(1)]}>{t('appUpdateInstalledVersion')}</Text>
        <Text color={colors.onSurfaceVariant}>{Constants.expoConfig?.version ?? '—'}</Text>
      </Row>
    </Column>
    <Column modifiers={cardModifiers}>
      <TextButton onClick={onLogout} contentPadding={rowPadding} modifiers={[fillMaxWidth(), testID('profile-disconnect')]}><Row modifiers={[fillMaxWidth()]}>
        <Column verticalArrangement={{ spacedBy: 3 }}><Text color={colors.error}>{t('disconnectSessionTitle')}</Text>
          <Text color={colors.onSurfaceVariant} style={{ typography: 'bodySmall' }}>{t('disconnectSessionBody')}</Text></Column>
      </Row></TextButton>
    </Column>
  </Column>;
}
