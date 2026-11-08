import { useCallback } from 'react';
import { rawSplitSessionIsCurrent } from './rawSplitApi';
import { useRawSplitContext } from './RawSplitContext';

/** Shared Profile accepts a synchronous guard; never allow a demo token or retired role ticket. */
export function useRawSplitProfileGuard(): () => boolean {
  const { session, ticket } = useRawSplitContext();
  return useCallback(() => session.token !== 'test-mode-token' && rawSplitSessionIsCurrent(ticket), [session, ticket]);
}
