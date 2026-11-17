import { useQolipRole } from './QolipRoleContext';
import { QolipStorageExpiredDialog } from './QolipStorageConfirm';
import { useQolipPassiveBoundary } from './useQolipPassiveBoundary';
import { DateRangePickerDialog, Host } from '@expo/ui/jetpack-compose';
import type { QolipStorageDateRange } from './qolipStorageReadState';
import { useQolipText } from './useQolipText';
import { extensionText } from '../shared/localization';
export function QolipStorageDateDialog({ initial, close }: { initial: QolipStorageDateRange | null; close(value: QolipStorageDateRange | null): void }) {
  const role = useQolipRole(), lifetime = useQolipPassiveBoundary(role.boundary);
  const { locale } = useQolipText(), t = (key: string) => extensionText('qolipStorageText', key, locale);
  const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
  if (!lifetime.valid) return <QolipStorageExpiredDialog message={t('session_changed')} close={() => close(null)} />;
  return <Host matchContents pointerEvents="none"><DateRangePickerDialog initialStartDate={initial?.from.toISOString()}
    initialEndDate={initial?.to.toISOString()} selectableDates={{ start: new Date(2000, 0, 1), end: tomorrow }}
    confirmButtonLabel={t('confirm')} dismissButtonLabel={t('cancel')} onDismissRequest={() => close(null)}
    onDateRangeSelected={value => { if (value.start && value.end) close({ from: value.start, to: value.end }); }} /></Host>;
}
