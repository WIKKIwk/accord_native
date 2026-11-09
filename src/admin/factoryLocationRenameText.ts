import { adminText } from '../shared/localization';

/** The host displays title above the native rename-dialog content. */
export function factoryLocationRenameText(locale: string) {
  return { title: adminText('factory.state_name_edit', locale), name: adminText('factory.state_name', locale),
    cancel: adminText('action.cancel', locale), save: adminText('action.save', locale) };
}
