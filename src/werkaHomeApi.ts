import type { Session } from './auth';
import { authorizedFetch } from './authorizedFetch';
import { werkaHomeFromJson } from './authenticateAccount';
/** @v2 werkaHome */
export async function werkaHome(session: Session) {
  const response = await authorizedFetch(session, '/v1/mobile/werka/home');
  if (response.status !== 200) throw new Error('Werka home failed');
  return werkaHomeFromJson(await response.json());
}
