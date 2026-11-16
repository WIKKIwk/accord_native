import { AdminTopNoticeService } from './adminTopNoticeService';

/** The actual service used by all Admin owners. Account state belongs to each original Messenger, never this singleton. */
export const adminTopNoticeService = new AdminTopNoticeService();
