import { PreparationNotice } from '../preparation/PreparationNotice';
import { isSynchronouslyTrue } from '../shared/camera/synchronousGuard';

export function AdminOwnedRouteNotice({ notice, isCurrent }: { notice: { serial: number; message: string } | null; isCurrent: () => boolean }) {
  return notice && isSynchronouslyTrue(isCurrent) ? <PreparationNotice message={notice.message} /> : null;
}
