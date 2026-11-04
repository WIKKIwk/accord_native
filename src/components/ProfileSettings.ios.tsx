import { Button, Group, HStack, Image, List, NavigationStack, Picker, SecureField, Section, Spacer, Text, Toggle, Toolbar, ToolbarItem } from '@expo/ui/swift-ui';
import { buttonStyle, disabled, font, foregroundStyle, frame, interactiveDismissDisabled, keyboardType, listStyle, navigationBarTitleDisplayMode, navigationTitle, pickerStyle, presentationDetents, presentationDragIndicator, tag } from '@expo/ui/swift-ui/modifiers';
import Constants from 'expo-constants';
import { useState } from 'react';
import { Alert } from 'react-native';
import { isAppearancePreference } from '../appAppearance';
import { useAppSettings } from './AppSettings';
import { usePinSetup } from './usePinSetup.ios';

type Props = { onClose: () => void; onLogout: () => void };
const secondary = foregroundStyle({ type: 'hierarchical', style: 'secondary' });

export function ProfileSettings({ onClose, onLogout }: Props) {
  const { appearance, setAppearance } = useAppSettings();
  const pin = usePinSetup();
  const [biometricBusy, setBiometricBusy] = useState(false);
  const closeSettings = async () => {
    if (pin.mode === 'remove' && !(await pin.submit())) return;
    onClose();
  };
  return <Group modifiers={[presentationDetents(['large']), presentationDragIndicator('visible'), interactiveDismissDisabled(pin.busy || biometricBusy)]}>
    <NavigationStack>
      <Toolbar modifiers={[navigationTitle('Sozlamalar'), navigationBarTitleDisplayMode('inline')]}>
        <List modifiers={[listStyle('insetGrouped')]}>
          <Section title="Ko‘rinish">
            <Picker label={<HStack spacing={12}>
              <Image systemName="circle.lefthalf.filled" size={18} modifiers={[frame({ width: 22 }), secondary]} />
              <Text>Yorug‘lik rejimi</Text>
            </HStack>} selection={appearance} onSelectionChange={value => {
              if (isAppearancePreference(value)) void setAppearance(value).catch(() => Alert.alert('Saqlab bo‘lmadi', 'Sozlamani qayta saqlab ko‘ring.'));
            }} modifiers={[pickerStyle('menu')]}>
              <Text modifiers={[tag('system')]}>Tizim</Text>
              <Text modifiers={[tag('light')]}>Yorug‘</Text>
              <Text modifiers={[tag('dark')]}>Qorong‘i</Text>
            </Picker>
          </Section>
          <Section title="Xavfsizlik">
            {!pin.mode ? <>
              <Button label={pin.security.hasPin ? 'PIN kodni o‘zgartirish' : 'PIN kodni o‘rnatish'} systemImage="lock" onPress={() => pin.open('set')} />
              {pin.security.hasPin ? <Button label="PIN kodni olib tashlash" systemImage="lock.open" onPress={() => pin.open('remove')} /> : null}
              <Toggle label="Biometrik ochish" isOn={pin.security.biometric} modifiers={[disabled(!pin.security.hasPin || !pin.security.canUseBiometric || biometricBusy)]}
                onIsOnChange={enabled => {
                  setBiometricBusy(true);
                  void pin.security.setBiometric(enabled).catch(() => Alert.alert('Biometrik tasdiq bajarilmadi', 'Qurilma biometrik sozlamalarini tekshirib, qayta urinib ko‘ring.'))
                    .finally(() => setBiometricBusy(false));
                }} />
              {!pin.security.canUseBiometric ? <Text modifiers={[font({ textStyle: 'footnote' }), secondary]}>Biometrik ochish qurilma yoki ilovaning ushbu versiyasida mavjud emas.</Text> : null}
            </> : <>
              {pin.mode === 'remove' ? <Text modifiers={[font({ textStyle: 'footnote' }), secondary]}>PIN’ni olib tashlash uchun joriy PIN’ni kiriting.</Text> : null}
              {pin.security.hasPin ? <SecureField text={pin.current} maxLength={4} placeholder="Joriy PIN" onTextChange={value => pin.change('current', value)} modifiers={[keyboardType('ascii-capable-number-pad'), disabled(pin.busy)]} /> : null}
              {pin.mode === 'set' ? <>
                <SecureField text={pin.pin} maxLength={4} placeholder="Yangi 4 xonali PIN" onTextChange={value => pin.change('pin', value)} modifiers={[keyboardType('ascii-capable-number-pad'), disabled(pin.busy)]} />
                <SecureField text={pin.repeat} maxLength={4} placeholder="PIN’ni takrorlang" onTextChange={value => pin.change('repeat', value)} modifiers={[keyboardType('ascii-capable-number-pad'), disabled(pin.busy)]} />
              </> : null}
              <Button label={pin.busy ? 'Saqlanmoqda…' : pin.mode === 'remove' ? 'PIN’ni olib tashlash' : 'Saqlash'} onPress={() => { void pin.submit(); }} modifiers={[disabled(pin.busy)]} />
              <Button label="Bekor qilish" onPress={pin.close} modifiers={[disabled(pin.busy)]} />
            </>}
          </Section>
          <Section title="Ilova">
            <HStack spacing={12}>
              <Image systemName="info.circle" size={18} modifiers={[frame({ width: 22 }), secondary]} />
              <Text>Versiya</Text><Spacer />
              <Text modifiers={[secondary]}>{Constants.expoConfig?.version ?? '—'}</Text>
            </HStack>
          </Section>
          <Section>
            <Button role="destructive" label="Sessiyani uzish" systemImage="rectangle.portrait.and.arrow.right" modifiers={[buttonStyle('plain')]} onPress={() => {
              Alert.alert('Sessiyani uzish', 'Ushbu qurilmada hisobdan chiqilsinmi?', [
                { text: 'Bekor qilish', style: 'cancel' },
                { text: 'Uzish', style: 'destructive', onPress: onLogout },
              ]);
            }} />
          </Section>
          <Section><Text modifiers={[font({ textStyle: 'footnote' }), secondary]}>Ko‘rinish tanlovi ushbu qurilmada saqlanadi.</Text></Section>
        </List>
        <Toolbar.Content><ToolbarItem placement="topBarTrailing"><Button label="Tayyor" onPress={() => { void closeSettings(); }} modifiers={[disabled(pin.busy || biometricBusy)]} /></ToolbarItem></Toolbar.Content>
      </Toolbar>
    </NavigationStack>
  </Group>;
}
