/** Temporary safety notice for the disabled shared Profile settings surface. */
export function adminProfileSettingsUnavailable(locale: string): string {
  const code = locale.toLowerCase().split(/[-_]/, 1)[0];
  if (code === 'uz') return 'Profil sozlamalari hozircha mavjud emas.';
  if (code === 'ru') return 'Настройки профиля пока недоступны.';
  if (code === 'ur') return 'پروفائل کی ترتیبات فی الحال دستیاب نہیں ہیں۔';
  return 'Profile settings are not available yet.';
}
