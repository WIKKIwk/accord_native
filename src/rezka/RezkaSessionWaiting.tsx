import { useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { useRezkaLocale } from './useRezkaShell';

export function RezkaSessionWaiting() {
  const [longWait, setLongWait] = useState(false), locale = useRezkaLocale().toLowerCase().split(/[-_]/, 1)[0];
  useEffect(() => { const timer = setTimeout(() => setLongWait(true), 15000); return () => clearTimeout(timer); }, []);
  const text = ({ uz: 'Sessiya yangilanishi hali tugamadi. Uzoq davom etsa, ilovani qayta oching.',
    en: 'The session is still updating. If this continues, reopen the app.',
    ru: 'Сеанс ещё обновляется. Если ожидание затянется, откройте приложение заново.',
    ur: 'سیشن ابھی اپ ڈیٹ ہو رہا ہے۔ اگر تاخیر جاری رہے تو ایپ دوبارہ کھولیں۔' } as Record<string, string>)[locale]
    ?? 'The session is still updating. If this continues, reopen the app.';
  return <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 }}>
    {longWait ? <Text>{text}</Text> : <ActivityIndicator />}
  </View>;
}
