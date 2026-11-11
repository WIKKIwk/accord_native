import { productionText } from './shared/localization';

/** @v2 _WorkerQueueLimitFilterState */
export function workerQueueLimitLabels(locale: string, choices: readonly number[]) {
  const language = locale.toLowerCase().split(/[-_]/)[0];
  return {
    title: language === 'ru' ? 'Показывать' : language === 'en' ? 'Show' : 'Ko‘rsatish',
    all: language === 'ru' ? 'Все' : language === 'en' ? 'All' : 'Barchasi',
    counts: Object.fromEntries(choices.filter(count => count !== 0).map(count =>
      [count, productionText('qolip.tasks.count', locale, { count })])),
  };
}
