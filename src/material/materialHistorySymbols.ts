import type { AndroidSymbol, SFSymbol } from 'expo-symbols';

type HistorySymbol = Readonly<{ ios: SFSymbol; android: AndroidSymbol }>;
const historySymbol: HistorySymbol = { ios: 'clock.arrow.circlepath', android: 'history' };
const symbols: Readonly<Record<string, HistorySymbol>> = {
  receipt_posted: { ios: 'tray.and.arrow.down', android: 'add_business' },
  order_reserved: { ios: 'tray.and.arrow.up', android: 'outbox' },
  order_unreserved: { ios: 'arrow.uturn.backward', android: 'undo' },
  usage_started: { ios: 'play.circle', android: 'play_circle_outline' },
  usage_cancelled: { ios: 'arrow.uturn.backward', android: 'undo' },
  consumption_posted: { ios: 'checkmark.circle', android: 'done_all' },
  consumption_reversed: { ios: 'arrow.uturn.backward', android: 'undo' },
  adjustment_increase: { ios: 'plus.circle', android: 'add_circle_outline' },
  adjustment_decrease: { ios: 'minus.circle', android: 'remove_circle_outline' },
  transfer_in: { ios: 'arrow.down.left', android: 'call_received' },
  transfer_out: { ios: 'arrow.up.right', android: 'call_made' },
};

/** @v2 _materialHistoryIcon: unlisted types use the history icon. */
export function materialHistorySymbol(type: string): HistorySymbol {
  return Object.hasOwn(symbols, type) ? symbols[type] : historySymbol;
}
