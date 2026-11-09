import { useSyncExternalStore } from 'react';
import { localeController } from '../shared/localization/runtime';

const subscribe = (listener: () => void) => localeController.addListener(listener);
const locale = () => localeController.locale;
/** The temporary hold is an intentional safety message, not a V2 parity claim. */
export function useRawSplitWriteHoldText(): string {
  const language = useSyncExternalStore(subscribe, locale, locale).toLowerCase().split(/[-_]/, 1)[0];
  if (language === 'ur') return 'حفاظتی جانچ مکمل ہونے تک محفوظ کرنا، مسئلہ درج کرنا، پرنٹر منتخب کرنا اور پرنٹ کرنا عارضی طور پر بند ہے۔';
  if (language === 'ru') return 'Сохранение, регистрация проблемы, выбор принтера и печать временно приостановлены до завершения проверки безопасности.';
  if (language === 'en') return 'Saving, issue reporting, printer selection and printing are temporarily paused pending a safety check.';
  return 'Xavfsizlik tekshiruvi tugaguncha saqlash, muammoni qayd etish, printer tanlash va chop etish vaqtincha to‘xtatilgan.';
}
