import { useAdminShellSession } from '../admin/useAdminShellSession';
import { brigaderMayEnter } from './brigaderAccess';

/** Reuse saved-account bootstrap and original-witness invalidation with Brigader's own admission. */
export function useBrigaderSession() { return useAdminShellSession(brigaderMayEnter); }
