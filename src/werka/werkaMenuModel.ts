import { localizedGetter } from '../shared/localization';

export type WerkaMenuKind = 'create' | 'archive' | 'period';
export type WerkaMenuAction = 'scan' | 'unannounced' | 'customerIssue' | 'batchDispatch' |
  'received' | 'sent' | 'returned' | 'daily' | 'monthly' | 'yearly';
export type WerkaMenuItem = { id: WerkaMenuAction; title: string; subtitle?: string };

/** The rows in V2 WerkaCreateHubScreen, WerkaArchiveScreen and WerkaArchivePeriodScreen. */
export function werkaMenuItems(kind: WerkaMenuKind, locale: string): WerkaMenuItem[] {
  const t = (key: string) => localizedGetter(key, locale);
  if (kind === 'create') return [
    { id: 'scan', title: 'QR skaner', subtitle: 'Paddon yoki WIP ma’lumotini ko‘rish va ixtiyoriy kirim' },
    { id: 'unannounced', title: t('unannouncedTitle'), subtitle: t('unannouncedDescription') },
    { id: 'customerIssue', title: t('customerIssueTitle'), subtitle: t('customerIssueDescription') },
    { id: 'batchDispatch', title: t('batchDispatchTitle'), subtitle: t('batchDispatchDescription') },
  ];
  if (kind === 'archive') return [
    { id: 'received', title: t('archiveReceivedTitle') },
    { id: 'sent', title: t('archiveSentTitle') },
    { id: 'returned', title: t('archiveReturnedTitle') },
  ];
  return [
    { id: 'daily', title: t('archiveDailyTitle') },
    { id: 'monthly', title: t('archiveMonthlyTitle') },
    { id: 'yearly', title: t('archiveYearlyTitle') },
  ];
}
