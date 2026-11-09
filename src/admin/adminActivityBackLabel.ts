/** Flutter MaterialLocalizations back tooltip in the installed SDK; deployed SDK parity remains open. */
export function adminActivityBackLabel(locale: string): string {
  const code = locale.toLowerCase().split(/[-_]/, 1)[0];
  return code === 'uz' ? 'Orqaga' : code === 'ru' ? 'Назад' : code === 'ur' ? 'پیچھے' : 'Back';
}
