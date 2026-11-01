import { Button, Column, Text } from '@expo/ui';
import Constants from 'expo-constants';
import { Alert, Platform } from 'react-native';
import type { AppearancePreference } from '../appAppearance';
import { useAppSettings } from './AppSettings';

type Props = { onClose: () => void; onLogout: () => void };
const choices: { id: AppearancePreference; label: string }[] = [
  { id: 'system', label: 'Tizim' }, { id: 'light', label: 'Yorug‘' }, { id: 'dark', label: 'Qorong‘i' },
];

export function ProfileSettings({ onClose, onLogout }: Props) {
  const { appearance, setAppearance } = useAppSettings();
  const disconnect = () => {
    if (Platform.OS === 'web') {
      if (globalThis.confirm('Ushbu qurilmada hisobdan chiqilsinmi?')) onLogout();
      return;
    }
    Alert.alert('Sessiyani uzish', 'Ushbu qurilmada hisobdan chiqilsinmi?', [
      { text: 'Bekor qilish', style: 'cancel' }, { text: 'Uzish', style: 'destructive', onPress: onLogout },
    ]);
  };
  return <Column spacing={12} style={{ padding: 20 }}>
    <Text textStyle={{ fontSize: 20, fontWeight: '600' }}>Sozlamalar</Text>
    {Platform.OS !== 'web' ? <Text>Yorug‘lik rejimi</Text> : null}
    {Platform.OS !== 'web' ? choices.map(choice => <Button key={choice.id} variant={appearance === choice.id ? 'filled' : 'text'} label={choice.label}
      onPress={() => { void setAppearance(choice.id).catch(() => Alert.alert('Saqlab bo‘lmadi')); }} />) : null}
    <Text>{`Versiya: ${Constants.expoConfig?.version ?? '—'}`}</Text>
    <Button variant="text" label="Sessiyani uzish" onPress={disconnect} />
    <Button variant="text" label="Tayyor" onPress={onClose} />
  </Column>;
}
