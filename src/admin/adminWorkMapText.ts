export function adminWorkMapText(locale: string) {
  const code = locale.toLowerCase().split(/[-_]/, 1)[0];
  if (code === 'ru') return { more: 'Загрузить ещё', pending: 'Chala buyurtma' };
  if (code === 'en') return { more: 'Load more', pending: 'Chala buyurtma' };
  if (code === 'ur') return { more: 'مزید لوڈ کریں', pending: 'Chala buyurtma' };
  return { more: 'Yana yuklash', pending: 'Chala buyurtma' };
}
