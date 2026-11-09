import { useSyncExternalStore } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { localeController } from '../shared/localization/runtime';

const subscribeLocale = (listener: () => void) => localeController.addListener(listener);
const currentLocale = () => localeController.locale;
export function adminTestTokenNotice(locale: string): string {
  const code = locale.toLowerCase().split(/[-_]/, 1)[0];
  if (code === 'uz') return 'Test token bilan ishlash hozir mavjud emas.';
  if (code === 'ru') return 'Работа с тестовым токеном пока недоступна.';
  if (code === 'ur') return 'ٹیسٹ ٹوکن کے ساتھ کام فی الحال دستیاب نہیں ہے۔';
  return 'Using the test token is not available yet.';
}
/** The legacy token is not a persisted demo-mode flag; this view makes no backend request. */
export function AdminTestTokenNotice() {
  const locale = useSyncExternalStore(subscribeLocale, currentLocale, currentLocale);
  return <View style={styles.root}><Text accessibilityRole="alert" style={styles.message}>{adminTestTokenNotice(locale)}</Text></View>;
}
const styles = StyleSheet.create({ root: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  message: { textAlign: 'center' } });
