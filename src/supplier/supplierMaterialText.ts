/** Flutter GlobalMaterialLocalizations.openAppDrawerTooltip for the app's supported locales. */
export function supplierMenuTooltip(locale: string): string {
  switch (locale.toLowerCase().split(/[-_]/, 1)[0]) {
    case 'uz': return 'Navigatsiya menyusini ochish';
    case 'ru': return 'Открыть меню навигации';
    case 'ur': return 'نیویگیشن مینیو کھولیں';
    default: return 'Open navigation menu';
  }
}
