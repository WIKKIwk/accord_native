import { currentSession } from '../auth';
import { sessionReadScope } from '../sessionReadScope';
import { ProductionDataRevision } from './productionDataRevision';

export const productionDataRevision = new ProductionDataRevision(() => {
  const session = currentSession();
  return session ? sessionReadScope(session) : '';
});
