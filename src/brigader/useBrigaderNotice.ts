import { useCallback } from 'react';
import { useAdminTopNoticeTarget } from '../admin/AdminTopNoticeProvider';
import { adminTopNoticeService } from '../admin/adminTopNoticeRuntime';
import type { AdminTopNoticeTone } from '../admin/adminTopNoticeModel';
export function useBrigaderNotice() {
  const { messenger } = useAdminTopNoticeTarget();
  return useCallback((message: string, tone: AdminTopNoticeTone) => {
    adminTopNoticeService.show(messenger, { message, tone });
  }, [messenger]);
}
