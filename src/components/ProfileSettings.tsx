import { Button, Column, ScrollView, Switch, Text, TextInput } from '@expo/ui';
import Constants from 'expo-constants';
import { Alert, Platform, useColorScheme } from 'react-native';
import type { AppearancePreference } from '../appAppearance';
import { useAppSettings } from './AppSettings';
import { usePinSetup } from './usePinSetup';

type Props = { onClose: () => void; onLogout: () => void };
const choices: { id: AppearancePreference; label: string }[] = [
  { id: 'system', label: 'Tizim' }, { id: 'light', label: 'Yorug‘' }, { id: 'dark', label: 'Qorong‘i' },
];

export function ProfileSettings({ onClose, onLogout }: Props) {
  const { appearance, setAppearance } = useAppSettings();
  const dark = useColorScheme() === 'dark';
  const pin = usePinSetup();
  const disconnect = () => {
    if (Platform.OS === 'web') {
      if (globalThis.confirm('Ushbu qurilmada hisobdan chiqilsinmi?')) onLogout();
      return;
    }
    Alert.alert('Sessiyani uzish', 'Ushbu qurilmada hisobdan chiqilsinmi?', [
      { text: 'Bekor qilish', style: 'cancel' }, { text: 'Uzish', style: 'destructive', onPress: onLogout },
    ]);
  };
  return <ScrollView><Column spacing={14} style={{ padding: 12 }}>
    <Text textStyle={{ fontSize: 22, fontWeight: '600' }}>Profil sozlamalari</Text>
    <Text>Tema va xavfsizlik sozlamalari</Text>
    {Platform.OS === 'android' && <Switch label="Qorong‘i rejim" value={dark}
      onValueChange={enabled => { void setAppearance(enabled ? 'dark' : 'light').catch(() => Alert.alert('Saqlab bo‘lmadi')); }} />}
    {Platform.OS !== 'web' && Platform.OS !== 'android' ? choices.map(choice => <Button key={choice.id} variant={appearance === choice.id ? 'filled' : 'text'} label={choice.label}
      onPress={() => { void setAppearance(choice.id).catch(() => Alert.alert('Saqlab bo‘lmadi')); }} />) : null}
    {Platform.OS !== 'web' && <><Text textStyle={{ fontSize: 20, fontWeight: '600' }}>Xavfsizlik</Text><Text>Ilova qulfi PIN kodi</Text></>}
    {Platform.OS !== 'web' && !pin.mode ? <>
      <Button label={pin.security.hasPin ? 'PIN kodni o‘zgartirish' : 'PIN kodni o‘rnatish'} onPress={() => pin.open('set')} />
      {pin.security.hasPin ? <Button variant="outlined" label="PIN kodni olib tashlash" onPress={() => pin.open('remove')} /> : null}
      <Switch label="Biometrik ochish" value={pin.security.biometric} disabled={!pin.security.hasPin || !pin.security.canUseBiometric}
        onValueChange={enabled => { void pin.security.setBiometric(enabled).catch(() => Alert.alert('Biometrik tasdiq bajarilmadi')); }} />
    </> : null}
    {Platform.OS !== 'web' && pin.mode ? <>
      {pin.security.hasPin ? <TextInput value={pin.current} secureTextEntry maxLength={4} keyboardType="number-pad" placeholder="Joriy PIN" onChangeText={value => pin.change('current', value)} /> : null}
      {pin.mode === 'set' ? <>
        <TextInput value={pin.pin} secureTextEntry maxLength={4} keyboardType="number-pad" placeholder="Yangi 4 xonali PIN" onChangeText={value => pin.change('pin', value)} />
        <TextInput value={pin.repeat} secureTextEntry maxLength={4} keyboardType="number-pad" placeholder="PIN’ni takrorlang" onChangeText={value => pin.change('repeat', value)} />
      </> : null}
      <Button label={pin.mode === 'remove' ? 'PIN’ni olib tashlash' : 'Saqlash'} disabled={pin.busy} onPress={() => { void pin.submit(); }} />
      <Button variant="text" label="Bekor qilish" disabled={pin.busy} onPress={pin.close} />
    </> : null}
    <Text>{`Versiya: ${Constants.expoConfig?.version ?? '—'}`}</Text>
    <Button variant="text" label="Sessiyani uzish" onPress={disconnect} />
    <Button variant="text" label="Tayyor" onPress={onClose} />
  </Column></ScrollView>;
}
