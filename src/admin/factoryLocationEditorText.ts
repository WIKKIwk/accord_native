import { adminText } from '../shared/localization';
import type { AdminFactoryLocation } from './factoryLocationModel';

// Flutter's installed MaterialLocalizations.deleteButtonTooltip; SDK lock remains an open item.
const deleteTooltips: Record<string, string> = { uz: 'Olib tashlash', en: 'Delete', ru: 'Удалить', ur: 'حذف کریں' };
export function factoryLocationEditorText(locale: string, location: AdminFactoryLocation | null) {
  const language = locale.toLowerCase().split(/[-_]/, 1)[0];
  return { title: adminText(location ? 'factory.state_edit' : 'factory.state_create', locale),
    name: adminText('factory.state_name', locale), note: location ? adminText('factory.state_id_note', locale, { id: location.id }) : null,
    attach: adminText('factory.attach_title', locale), empty: adminText('factory.no_equipment_linked', locale),
    nameRequired: adminText('factory.enter_state_name', locale), save: adminText('action.save', locale),
    cancel: adminText('action.cancel', locale), deleteTooltip: Object.hasOwn(deleteTooltips, language) ? deleteTooltips[language] : deleteTooltips.en };
}
