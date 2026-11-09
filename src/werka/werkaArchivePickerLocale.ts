import { werkaArchiveMonthYear } from './werkaArchiveDateLabels';
import type { WerkaArchivePickerLocale } from './werkaArchivePickerPresentation';

// V2's four resolved app locales, using its declared Flutter 3.47.8 Material
// data and locked intl 0.20.3. See the standalone source-data fixture.
type Language = 'uz' | 'en' | 'ru' | 'ur';
type Data = {
  firstDayOfWeekIndex: number;
  narrow: readonly string[];
  weekdays: readonly string[];
  months: readonly string[];
  previous: string;
  next: string;
  selectYear: string;
  today: string;
};
const data: Record<Language, Data> = {
  uz: {
    firstDayOfWeekIndex: 1, narrow: ['Y', 'D', 'S', 'C', 'P', 'J', 'S'],
    weekdays: ['yakshanba', 'dushanba', 'seshanba', 'chorshanba', 'payshanba', 'juma', 'shanba'],
    months: ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr'],
    previous: 'Avvalgi oy', next: 'Keyingi oy', selectYear: 'Yilni tanlang', today: 'Bugun',
  },
  en: {
    firstDayOfWeekIndex: 0, narrow: ['S', 'M', 'T', 'W', 'T', 'F', 'S'],
    weekdays: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
    months: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
    previous: 'Previous month', next: 'Next month', selectYear: 'Select year', today: 'Today',
  },
  ru: {
    firstDayOfWeekIndex: 1, narrow: ['В', 'П', 'В', 'С', 'Ч', 'П', 'С'],
    weekdays: ['воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота'],
    months: ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'],
    previous: 'Предыдущий месяц', next: 'Следующий месяц', selectYear: 'Выберите год', today: 'Сегодня',
  },
  ur: {
    // The SDK resolves ur_PK date data to ur, whose narrow weekdays are Latin.
    firstDayOfWeekIndex: 0, narrow: ['S', 'M', 'T', 'W', 'T', 'F', 'S'],
    weekdays: ['اتوار', 'پیر', 'منگل', 'بدھ', 'جمعرات', 'جمعہ', 'ہفتہ'],
    months: ['جنوری', 'فروری', 'مارچ', 'اپریل', 'مئی', 'جون', 'جولائی', 'اگست', 'ستمبر', 'اکتوبر', 'نومبر', 'دسمبر'],
    previous: 'پچھلا مہینہ', next: 'اگلا مہینہ', selectYear: 'سال منتخب کریں', today: 'آج',
  },
};

/** Use the app's resolved locale; arbitrary unsupported locale fallback is not inferred here. */
export function werkaArchivePickerLocale(locale: string): WerkaArchivePickerLocale {
  const code = locale.toLowerCase().split(/[-_]/, 1)[0];
  if (code !== 'uz' && code !== 'en' && code !== 'ru' && code !== 'ur') throw new RangeError();
  const names = data[code], formatYear = (year: number) => {
    if (!Number.isSafeInteger(year)) throw new RangeError();
    return String(Math.abs(year));
  };
  const formatDecimal = (number: number) => {
    if (!Number.isSafeInteger(number)) throw new RangeError();
    const separator = code === 'uz' || code === 'ru' ? '\u00a0' : ',';
    const digits = String(Math.abs(number)).replace(/\B(?=(\d{3})+(?!\d))/g, separator);
    return number < 0 ? `${code === 'ur' ? '\u200e' : ''}-${digits}` : digits;
  };
  const formatFullDate = (date: Date) => {
    if (!Number.isFinite(date.getTime())) throw new RangeError();
    const weekday = names.weekdays[date.getDay()], month = names.months[date.getMonth()];
    const day = date.getDate(), year = formatYear(date.getFullYear());
    if (code === 'uz') return `${weekday}, ${day}-${month}, ${year}`;
    if (code === 'en') return `${weekday}, ${month} ${day}, ${year}`;
    if (code === 'ru') return `${weekday}, ${day} ${month} ${year}\u202fг.`;
    return `${weekday}، ${day} ${month}، ${year}`;
  };
  return { firstDayOfWeekIndex: names.firstDayOfWeekIndex, narrowWeekdays: [...names.narrow], formatDecimal,
    formatYear, formatFullDate, formatMonthYear: date => werkaArchiveMonthYear(date, code),
    previousMonthTooltip: names.previous, nextMonthTooltip: names.next,
    selectYearSemanticsLabel: names.selectYear, currentDateLabel: names.today };
}
