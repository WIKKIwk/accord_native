export function adminWorkMapText(locale: string) {
  const code = locale.toLowerCase().split(/[-_]/, 1)[0];
  if (code === 'ru') return { partial: 'Пока доступны только список заказов и основные сведения. Другие разделы карты работ ещё не перенесены.', more: 'Загрузить ещё', pending: 'Chala buyurtma' };
  if (code === 'en') return { partial: 'Only the order list and basic details are available so far. Other work map sections are not yet ported.', more: 'Load more', pending: 'Chala buyurtma' };
  if (code === 'ur') return { partial: 'فی الحال صرف آرڈرز کی فہرست اور بنیادی تفصیلات دستیاب ہیں۔ کام کے نقشے کے دیگر حصے ابھی منتقل نہیں ہوئے۔', more: 'مزید لوڈ کریں', pending: 'Chala buyurtma' };
  return { partial: 'Hozircha faqat buyurtmalar ro‘yxati va asosiy ma’lumotlari mavjud. Ish xaritasining boshqa bo‘limlari hali ko‘chirilmagan.', more: 'Yana yuklash', pending: 'Chala buyurtma' };
}
