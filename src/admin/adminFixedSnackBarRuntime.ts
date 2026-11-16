import type { AdminTopNoticeMessenger } from './adminTopNoticeMessenger';
import { AdminFixedSnackBarController } from './adminFixedSnackBarController';

const queues = new WeakMap<AdminTopNoticeMessenger, AdminFixedSnackBarController>();
/** Exact Source Messenger identity selects one independent ordinary FIFO. It never shares TopNotice's latest handle/timer. */
export function adminFixedSnackBarController(messenger: AdminTopNoticeMessenger): AdminFixedSnackBarController {
  const existing = queues.get(messenger); if (existing) return existing;
  const controller = new AdminFixedSnackBarController({ messenger }); queues.set(messenger, controller); return controller;
}
