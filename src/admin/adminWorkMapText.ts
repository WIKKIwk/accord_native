export function adminWorkMapText(locale: string) {
  const code = locale.toLowerCase().split(/[-_]/, 1)[0];
  if (code === 'ru') return { partial: 'Пока доступны только просмотр очереди и панелей переноса, список заказов, закрытые заказы, проверка и основные сведения. Остальные разделы и действия карты работ ещё не перенесены.', more: 'Загрузить ещё', pending: 'Chala buyurtma' };
  if (code === 'en') return { partial: 'Only sequence viewing, read-only move panes, the order list, closed summaries, audit and basic details are available so far. Other work map sections and actions are not yet ported.', more: 'Load more', pending: 'Chala buyurtma' };
  if (code === 'ur') return { partial: 'فی الحال صرف ترتیب اور منتقلی کے پینلز دیکھنا، آرڈرز کی فہرست، بند آرڈرز کا خلاصہ، جانچ اور بنیادی تفصیلات دستیاب ہیں۔ کام کے نقشے کے دیگر حصے اور اعمال ابھی منتقل نہیں ہوئے۔', more: 'مزید لوڈ کریں', pending: 'Chala buyurtma' };
  return { partial: 'Hozircha faqat ketma-ketlik va ko‘chirish panellarini ko‘rish, buyurtmalar ro‘yxati, yopilgan buyurtmalar, tekshiruv va asosiy ma’lumotlari mavjud. Ish xaritasining boshqa bo‘limlari va amallari hali ko‘chirilmagan.', more: 'Yana yuklash', pending: 'Chala buyurtma' };
}
