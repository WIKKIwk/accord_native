/** Flutter GlobalMaterialLocalizations.openAppDrawerTooltip for the app's supported locales. */
export function supplierMenuTooltip(locale: string): string {
  switch (locale.toLowerCase().split(/[-_]/, 1)[0]) {
    case 'uz': return 'Navigatsiya menyusini ochish';
    case 'ru': return 'Открыть меню навигации';
    case 'ur': return 'نیویگیشن مینیو کھولیں';
    default: return 'Open navigation menu';
  }
}

/** Flutter GlobalMaterialLocalizations.modalBarrierDismissLabel used by AppShell's drawer scrim. */
export function supplierDismissTooltip(locale: string): string {
  switch (locale.toLowerCase().split(/[-_]/, 1)[0]) {
    case 'uz': return 'Yopish';
    case 'ru': return 'Закрыть';
    case 'ur': return 'برخاست کریں';
    default: return 'Dismiss';
  }
}
