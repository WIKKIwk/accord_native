import { Text, View } from 'react-native';
import { useRezkaLocale } from './useRezkaShell';

/** The persisted V2 test-mode flag is not implemented; this only blocks its known fake token. */
export function RezkaTestSessionUnavailable() {
  const locale = useRezkaLocale().toLowerCase().split(/[-_]/, 1)[0];
  const message = ({ uz: 'Bu test sessiyasi hozircha qo‘llab-quvvatlanmaydi.', en: 'This test session is not supported yet.',
    ru: 'Эта тестовая сессия пока не поддерживается.', ur: 'یہ آزمائشی سیشن ابھی دستیاب نہیں ہے۔' } as Record<string, string>)[locale]
    ?? 'This test session is not supported yet.';
  return <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 }}><Text>{message}</Text></View>;
}
