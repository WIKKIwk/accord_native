// Source: V2 GlobalMaterialLocalizations with Flutter 3.47.8 generated date data
// (737ba8f885dc774b53b442759999a312c9461e4e) and locked intl 0.20.3.
// Only the four app languages and the archive's two formats are covered.
// See tests/contracts/f11910bb/werka_archive_date_oracle.{dart,json}.
type Language = 'uz' | 'en' | 'ru' | 'ur';
const labels: Record<Language, { months: readonly string[]; shortMonths: readonly string[]; weekdays: readonly string[] }> = {
  uz: {
    months: ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr'],
    shortMonths: ['yan', 'fev', 'mar', 'apr', 'may', 'iyn', 'iyl', 'avg', 'sen', 'okt', 'noy', 'dek'],
    weekdays: ['Yak', 'Dush', 'Sesh', 'Chor', 'Pay', 'Jum', 'Shan'],
  },
  en: {
    months: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
    shortMonths: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
    weekdays: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
  },
  ru: {
    // yMMMM uses LLLL (standalone month), while MMMEd uses short month data.
    months: ['январь', 'февраль', 'март', 'апрель', 'май', 'июнь', 'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь'],
    shortMonths: ['янв.', 'февр.', 'мар.', 'апр.', 'мая', 'июн.', 'июл.', 'авг.', 'сент.', 'окт.', 'нояб.', 'дек.'],
    weekdays: ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'],
  },
  ur: {
    months: ['جنوری', 'فروری', 'مارچ', 'اپریل', 'مئی', 'جون', 'جولائی', 'اگست', 'ستمبر', 'اکتوبر', 'نومبر', 'دسمبر'],
    shortMonths: ['جنوری', 'فروری', 'مارچ', 'اپریل', 'مئی', 'جون', 'جولائی', 'اگست', 'ستمبر', 'اکتوبر', 'نومبر', 'دسمبر'],
    weekdays: ['اتوار', 'پیر', 'منگل', 'بدھ', 'جمعرات', 'جمعہ', 'ہفتہ'],
  },
};

function language(locale: string): Language {
  const code = locale.toLowerCase().split(/[-_]/, 1)[0];
  // The caller supplies the app's resolved locale, not an arbitrary device locale.
  if (code === 'uz' || code === 'en' || code === 'ru' || code === 'ur') return code;
  throw new RangeError();
}
function fields(date: Date, locale: string) {
  if (!Number.isFinite(date.getTime())) throw new RangeError();
  const code = language(locale);
  return { code, names: labels[code], month: date.getMonth(), day: date.getDate(), weekday: date.getDay() };
}

/** Material formatMonthYear for archive-local calendar dates, without host Intl/ICU differences. */
export function werkaArchiveMonthYear(date: Date, locale: string): string {
  const { code, names, month } = fields(date, locale), name = names.months[month];
  // intl 0.20.3 formatYear uses the absolute year, including year zero.
  const year = Math.abs(date.getFullYear());
  return code === 'uz' ? `${name}, ${year}` : code === 'ru' ? `${name} ${year}\u202fг.` : `${name} ${year}`;
}

/** Material formatMediumDate uses MMMEd, not a medium Intl date containing a year. */
export function werkaArchiveMediumDate(date: Date, locale: string): string {
  const { code, names, month, day, weekday } = fields(date, locale);
  const week = names.weekdays[weekday], name = names.shortMonths[month];
  return code === 'uz' ? `${week}, ${day}-${name}` : code === 'en' ? `${week}, ${name} ${day}`
    : code === 'ur' ? `${week}، ${day} ${name}` : `${week}, ${day} ${name}`;
}
