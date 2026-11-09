import type { AndroidSymbol, SFSymbol } from 'expo-symbols';
import type { DispatchRecord } from '../shared/notificationApi';

/** Native approximations of the six V2 Material symbols, not pixel-equivalent assets. */
const symbols: Record<DispatchRecord['status'], { ios: SFSymbol; android: AndroidSymbol }> = {
  draft: { ios: 'clock.fill', android: 'schedule' },
  pending: { ios: 'clock', android: 'schedule' },
  accepted: { ios: 'checkmark.circle', android: 'done_all' },
  partial: { ios: 'checkmark', android: 'check' },
  rejected: { ios: 'xmark', android: 'close' },
  cancelled: { ios: 'minus', android: 'remove' },
};
export function adminActivitySymbol(status: DispatchRecord['status']) { return symbols[status]; }
