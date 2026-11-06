import { Button, Group, HStack, Image, List, NavigationStack, Picker, SecureField, Section, Spacer, Text, Toggle, Toolbar, ToolbarItem } from '@expo/ui/swift-ui';
import { buttonStyle, disabled, font, foregroundStyle, frame, interactiveDismissDisabled, keyboardType, listStyle, navigationBarTitleDisplayMode, navigationTitle, pickerStyle, presentationDetents, presentationDragIndicator, tag } from '@expo/ui/swift-ui/modifiers';
import Constants from 'expo-constants';
import { useState, type ReactNode } from 'react';
import { Alert } from 'react-native';
import { isAppearancePreference, type AppearancePreference } from '../appAppearance';
import type { Session } from '../auth';
import { useAppSettings } from './AppSettings';
import { usePinSetup } from './usePinSetup.ios';

type Props = { session?: Session; onClose: () => void; onLogout: () => void; preferences?: ReactNode; switchPin?: ReactNode;
  switchPinBusy?: boolean; onAppearanceChange?: (value: AppearancePreference) => Promise<void>;
  translate?: (key: string) => string };
const secondary = foregroundStyle({ type: 'hierarchical', style: 'secondary' });

// @v2 _ProfileSettingsSheet
export function ProfileSettings({ onClose, onLogout, preferences, switchPin, switchPinBusy = false, onAppearanceChange, translate }: Props) {
  const { appearance, setAppearance } = useAppSettings();
  const pin = usePinSetup();
  const [biometricBusy, setBiometricBusy] = useState(false);
  const label = (key: string, fallback: string) => translate ? translate(key) : fallback;
  const setBiometric = (enabled: boolean) => {
    setBiometricBusy(true);
    void pin.security.setBiometric(enabled).catch(() => Alert.alert(
      label('biometricEnableTitle', 'Biometrik tasdiq bajarilmadi'),
      label(enabled ? 'biometricEnableFailed' : 'biometricDisableFailed', 'Qurilma biometrik sozlamalarini tekshirib, qayta urinib ko‘ring.'),
    )).finally(() => setBiometricBusy(false));
  };
  const submitPin = async () => {
    const setting = pin.mode === 'set';
    if (!(await pin.submit()) || !setting || !pin.security.canUseBiometric || pin.security.biometric) return;
    Alert.alert(label('biometricQuickUnlockTitle', 'Tezkor ochish'), label('biometricQuickUnlockPrompt', 'Biometrik ochishni yoqasizmi?'), [
      { text: label('no', 'Yo‘q'), style: 'cancel' },
      { text: label('yes', 'Ha'), onPress: () => setBiometric(true) },
    ]);
  };
  const closeSettings = () => { onClose(); };
  return <Group modifiers={[presentationDetents(['large']), presentationDragIndicator('visible'), interactiveDismissDisabled(pin.busy || biometricBusy || switchPinBusy)]}>
    <NavigationStack>
      <Toolbar modifiers={[navigationTitle(label('profileSettingsTitle', 'Sozlamalar')), navigationBarTitleDisplayMode('inline')]}>
        <List modifiers={[listStyle('insetGrouped')]}>
          {preferences}
          <Section title="Ko‘rinish">
            <Picker label={<HStack spacing={12}>
              <Image systemName="circle.lefthalf.filled" size={18} modifiers={[frame({ width: 22 }), secondary]} />
              <Text>{label('themeModeTitle', 'Yorug‘lik rejimi')}</Text>
            </HStack>} selection={appearance} onSelectionChange={value => {
              if (isAppearancePreference(value)) void Promise.all([setAppearance(value), onAppearanceChange?.(value)])
                .catch(() => Alert.alert('Saqlab bo‘lmadi', 'Sozlamani qayta saqlab ko‘ring.'));
            }} modifiers={[pickerStyle('menu')]}>
              <Text modifiers={[tag('light')]}>Yorug‘</Text>
              <Text modifiers={[tag('dark')]}>Qorong‘i</Text>
            </Picker>
          </Section>
          <Section title={label('securityTitle', 'Xavfsizlik')}>
            {!pin.mode ? <>
              <Button label={pin.security.hasPin ? label('pinChange', 'PIN kodni o‘zgartirish') : label('pinSet', 'PIN kodni o‘rnatish')} systemImage="lock" onPress={() => pin.open('set')} />
              {pin.security.hasPin ? <Button label={label('pinRemove', 'PIN kodni olib tashlash')} systemImage="lock.open" onPress={() => { void pin.remove(); }} modifiers={[disabled(pin.busy)]} /> : null}
              <Toggle label={label('biometricEnableTitle', 'Biometrik ochish')} isOn={pin.security.biometric} modifiers={[disabled(!pin.security.hasPin || biometricBusy)]}
                onIsOnChange={setBiometric} />
              {!pin.security.canUseBiometric ? <Text modifiers={[font({ textStyle: 'footnote' }), secondary]}>Biometrik ochish qurilma yoki ilovaning ushbu versiyasida mavjud emas.</Text> : null}
            </> : <>
              {pin.mode === 'set' ? <Text>{label(pin.phase === 'entry' ? 'pinEnterTitle' : 'pinRepeatTitle', pin.phase === 'entry' ? 'PIN kiriting' : 'PIN takrorlang')}</Text> : null}
              {pin.mode === 'set' && pin.phase === 'entry' ? <SecureField text={pin.pin} maxLength={4} placeholder="PIN" onTextChange={value => pin.change('pin', value)} modifiers={[keyboardType('ascii-capable-number-pad'), disabled(pin.busy)]} /> : null}
              {pin.mode === 'set' && pin.phase === 'confirm' ? <SecureField text={pin.repeat} maxLength={4} placeholder="PIN" onTextChange={value => pin.change('repeat', value)} modifiers={[keyboardType('ascii-capable-number-pad'), disabled(pin.busy)]} /> : null}
              {pin.mode === 'set' && pin.phaseError ? <Text>{pin.phaseError}</Text> : null}
              {pin.mode === 'set' && pin.phase === 'entry' ? <Button label={label('nextItemAction', 'Keyingi')} onPress={pin.next} modifiers={[disabled(pin.busy || !pin.canNext)]} /> :
                <Button label={pin.busy ? label('pinSaving', 'Saqlanmoqda…') : pin.mode === 'remove' ? label('pinRemove', 'PIN’ni olib tashlash') : label('save', 'Saqlash')} onPress={() => { void submitPin(); }} modifiers={[disabled(pin.busy)]} />}
              <Button label="Bekor qilish" onPress={pin.mode === 'set' ? pin.back : pin.close} modifiers={[disabled(pin.busy)]} />
            </>}
          </Section>
          {switchPin}
          <Section title="Ilova">
            <HStack spacing={12}>
              <Image systemName="info.circle" size={18} modifiers={[frame({ width: 22 }), secondary]} />
              <Text>Versiya</Text><Spacer />
              <Text modifiers={[secondary]}>{Constants.expoConfig?.version ?? '—'}</Text>
            </HStack>
          </Section>
          <Section>
            <Button role="destructive" label={label('disconnectSessionTitle', 'Sessiyani uzish')} systemImage="rectangle.portrait.and.arrow.right" modifiers={[buttonStyle('plain')]} onPress={() => {
              onClose();
              Alert.alert(label('disconnectSessionTitle', 'Sessiyani uzish'), label('disconnectSessionBody', 'Ushbu qurilmada hisobdan chiqilsinmi?'), [
                { text: label('no', 'Bekor qilish'), style: 'cancel' },
                { text: label('yes', 'Uzish'), style: 'destructive', onPress: onLogout },
              ]);
            }} />
          </Section>
          <Section><Text modifiers={[font({ textStyle: 'footnote' }), secondary]}>Ko‘rinish tanlovi ushbu qurilmada saqlanadi.</Text></Section>
        </List>
        <Toolbar.Content><ToolbarItem placement="topBarTrailing"><Button label="Tayyor" onPress={closeSettings} modifiers={[disabled(pin.busy || biometricBusy || switchPinBusy)]} /></ToolbarItem></Toolbar.Content>
      </Toolbar>
    </NavigationStack>
  </Group>;
}
