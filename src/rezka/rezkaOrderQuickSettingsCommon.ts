import { Alert } from 'react-native';
import { rezkaOrderSettingsVisibility } from './rezkaOrderEligibility';
import { isRezkaSessionCurrent } from './rezkaSessionGuard';
import type { RezkaOrderConfirmation, RezkaOrderOption, RezkaOrderSettingsController } from './rezkaOrderSettingsController';
import type { RezkaOrderQuickSettingsProps } from './rezkaOrderQuickSettingsTypes';

export function quickSettingsVisibility({ snapshot, map, entry }: RezkaOrderQuickSettingsProps) {
  if (!isRezkaSessionCurrent(snapshot, 'master')) return { showPrintSide: false, showWorkOptions: false };
  const session = snapshot.session;
  return rezkaOrderSettingsVisibility(map, entry, session.profile.role, session.assigned_apparatus);
}
export function showRezkaOrderConfirmation(controller: RezkaOrderSettingsController, option: RezkaOrderOption, enabled: boolean,
  text: { title(): string; confirmation(value: RezkaOrderConfirmation): string; production(key: string): string }) {
  const pending = controller.request(option, enabled);
  if (!pending) return;
  try {
    Alert.alert(text.title(), text.confirmation(pending), [
      { text: text.production('worker.action.cancel'), style: 'cancel', onPress: () => controller.cancel(pending) },
      { text: text.production('worker.action.confirm'), onPress: () => { void controller.confirm(pending); } },
    ], { cancelable: true, onDismiss: () => controller.cancel(pending) });
  } catch { controller.cancel(pending); }
}
