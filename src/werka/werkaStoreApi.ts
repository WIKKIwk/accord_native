import { werkaHome } from '../werkaHomeApi';
import { dispatchRecordFromJson } from '../shared/notificationApi';
import { werkaHistory, werkaPending, werkaStatusBreakdown, werkaStatusDetails } from './werkaRecordApi';
import type { WerkaStoreApi } from './werkaStore';

function count(value: unknown): number {
  if (!Number.isInteger(value)) throw new TypeError('Invalid Werka summary count');
  return value as number;
}

/** Adapter reusing the existing home and shared dispatch parsers. */
export const werkaStoreApi: WerkaStoreApi = {
  async home(session) {
    const data = await werkaHome(session);
    return { summary: { pendingCount: count(data.summary.pending_count), confirmedCount: count(data.summary.confirmed_count),
      returnedCount: count(data.summary.returned_count) }, pendingItems: data.pending_items.map(dispatchRecordFromJson) };
  },
  pending: werkaPending,
  history: werkaHistory,
  breakdown: werkaStatusBreakdown,
  details: werkaStatusDetails,
};
