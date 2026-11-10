import { useCallback, useMemo } from 'react';
import { activeSessionToken, type Session } from '../auth';
import { adminApparatus } from '../apparatusApi';
import { sessionReadScope } from '../sessionReadScope';
import { appRoutes, canOpenRoute } from '../shared/appRoutes';
import { useApparatusWorkInstructions } from '../rezka/useRezkaWorkInstructions';

export function useWorkerWorkInstructions(session: Session) {
  const scope = useMemo(() => sessionReadScope(session), [session]);
  const isCurrent = useCallback(() => !!activeSessionToken(session) && sessionReadScope(session) === scope &&
    canOpenRoute(session, appRoutes.apparatusWorkInstructions), [session, scope]);
  const load = useCallback(() => adminApparatus(session, { limit: 300, beforeSend: () => {
    if (!isCurrent()) throw new Error('Session scope changed');
  } }), [session, isCurrent]);
  return useApparatusWorkInstructions(session, isCurrent, load);
}
