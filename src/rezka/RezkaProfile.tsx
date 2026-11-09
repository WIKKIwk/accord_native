import { useCallback } from 'react';
import { ProfileScreen } from '../components/ProfileScreen';
import { isRezkaSessionCurrent, type RezkaSessionSnapshot } from './rezkaSessionGuard';
import { useRezkaLocale } from './useRezkaShell';

export function RezkaProfile({ snapshot, onLogout, onDailyWork }: { snapshot: RezkaSessionSnapshot; onLogout: () => void; onDailyWork: () => void }) {
  const locale = useRezkaLocale().toLowerCase().split(/[-_]/, 1)[0];
  const isCurrent = useCallback(() => isRezkaSessionCurrent(snapshot, 'master'), [snapshot]);
  const unavailable = ({ uz: 'Profil sozlamalari hozircha mavjud emas.', en: 'Profile settings are not available yet.',
    ru: 'Настройки профиля пока недоступны.', ur: 'پروفائل کی ترتیبات ابھی دستیاب نہیں ہیں۔' } as Record<string, string>)[locale]
    ?? 'Profile settings are not available yet.';
  if (!isCurrent()) return null;
  return <ProfileScreen session={snapshot.session} isCurrent={isCurrent} settingsUnavailableMessage={unavailable}
    onLogout={() => { if (isCurrent()) onLogout(); }} onDailyWork={() => { if (isCurrent()) onDailyWork(); }} />;
}
