import { localizedGetter, productionText } from '../shared/localization';
import type { AdditionalSettingsController, AdditionalSettingsSnapshot, SettingsNotice } from './additionalSettingsController';

export type AdditionalSettingAction = 'appUpdate' | 'freeMovement' | 'workerVisibility' | 'laminationWip' | 'laminationFilm' | 'qolip';
export type AdditionalSettingCardId = 'appUpdate' | 'freeMovement' | 'workerVisibility' | 'lamination' | 'qolip';
export type AdditionalSettingRow = { action: AdditionalSettingAction; title: string; subtitle: string; value: boolean; enabled: boolean; testID: string };
export type AdditionalSettingCard = { id: AdditionalSettingCardId; rows: AdditionalSettingRow[]; busy: boolean; error: string | null };
export function additionalSettingsText(locale: string) {
  const get = (key: string) => localizedGetter(key, locale), prod = (key: string) => productionText(key, locale);
  return { title: prod('paddon.management.settings.title'), retry: get('retry'), yes: get('yes'), no: get('no'),
    loadError: get('serverDisconnectedRetry'), confirmTitle: prod('paddon.management.free_movement.confirm'),
    confirmMessage: prod('paddon.management.free_movement.description'),
    appTitle: get('appUpdateMandatorySettingTitle'), appBody: get('appUpdateMandatorySettingBody'),
    appLoadError: get('appUpdateSettingsLoadFailed'),
    freeTitle: prod('paddon.management.free_movement.title'), freeBody: prod('paddon.management.free_movement.description'),
    visibilityTitle: prod('paddon.management.worker_visibility.title'), visibilityBody: prod('paddon.management.worker_visibility.description'),
    wipTitle: prod('lamination.settings.wip_label'), filmTitle: prod('lamination.settings.film_label'),
    laminationBody: prod('lamination.settings.label_description'), laminationLoadError: prod('lamination.settings.load_failed'),
    qolipTitle: prod('qolip.start.settings.title'), qolipBody: prod('qolip.start.settings.description'),
    qolipLoadError: prod('qolip.start.settings.load_failed') };
}
export function additionalSettingsNotice(notice: SettingsNotice, locale: string): string {
  return notice.source === 'getter' ? localizedGetter(notice.key, locale) : productionText(notice.key, locale);
}
export function additionalSettingsCards(state: AdditionalSettingsSnapshot, locale: string): AdditionalSettingCard[] {
  if (state.screen !== 'content' || !state.paddon.value) return [];
  const t = additionalSettingsText(locale), card = <T>(value: { value: T | null; busy: boolean; failed: boolean }) =>
    !value.busy && !value.failed && value.value != null;
  const result: AdditionalSettingCard[] = [];
  if (!state.operator) result.push({ id: 'appUpdate', busy: state.appUpdate.busy, error: state.appUpdate.failed ? t.appLoadError : null,
    rows: [{ action: 'appUpdate', title: t.appTitle, subtitle: t.appBody, value: state.appUpdate.value ?? false,
      enabled: card(state.appUpdate), testID: 'mandatory-app-update-switch' }] });
  result.push({ id: 'freeMovement', busy: false, error: null, rows: [{ action: 'freeMovement', title: t.freeTitle, subtitle: t.freeBody,
    value: state.paddon.value.free_movement_enabled, enabled: !state.paddon.busy && !state.confirmFreeMovement, testID: 'paddon-free-movement-switch' }] });
  result.push({ id: 'workerVisibility', busy: false, error: null, rows: [{ action: 'workerVisibility', title: t.visibilityTitle, subtitle: t.visibilityBody,
    value: state.paddon.value.worker_visibility_enabled, enabled: !state.paddon.busy && !state.confirmFreeMovement, testID: 'paddon-worker-visibility-switch' }] });
  if (!state.operator) {
    result.push({ id: 'lamination', busy: state.lamination.busy, error: state.lamination.failed ? t.laminationLoadError : null, rows: [
      { action: 'laminationWip', title: t.wipTitle, subtitle: t.laminationBody, value: state.lamination.value?.print_wip_remainder_labels ?? true,
        enabled: card(state.lamination), testID: 'lamination-wip-label-switch' },
      { action: 'laminationFilm', title: t.filmTitle, subtitle: t.laminationBody, value: state.lamination.value?.print_film_remainder_labels ?? true,
        enabled: card(state.lamination), testID: 'lamination-film-label-switch' },
    ] });
    result.push({ id: 'qolip', busy: state.qolip.busy, error: state.qolip.failed ? t.qolipLoadError : null,
      rows: [{ action: 'qolip', title: t.qolipTitle, subtitle: t.qolipBody, value: state.qolip.value?.automatic_confirmation_enabled ?? false,
        enabled: card(state.qolip), testID: 'qolip-automatic-confirmation-switch' }] });
  }
  return result;
}

export function changeAdditionalSetting(controller: AdditionalSettingsController, action: AdditionalSettingAction, value: boolean): void {
  switch (action) {
    case 'appUpdate': controller.setAppUpdate(value); break;
    case 'freeMovement': controller.requestFreeMovement(value); break;
    case 'workerVisibility': controller.setWorkerVisibility(value); break;
    case 'laminationWip': controller.setLaminationWip(value); break;
    case 'laminationFilm': controller.setLaminationFilm(value); break;
    case 'qolip': controller.setQolip(value); break;
  }
}
