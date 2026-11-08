import { activeSessionToken, saveSession, type Session } from './auth';
import { authorizedFetch } from './authorizedFetch';
import { sessionReadScope } from './sessionReadScope';
import { WorkerControlException } from './workerControlsApi';
import { profileFromLogin } from './authenticateAccount';
import { assertProfileIdentity, isProfileSessionCurrent, type ProfileSessionGuard } from './shared/profileSessionGuard';

/** @v2 profile */
export async function profile(session: Session, onlyWhenApparatusChanged = false, isCurrent?: ProfileSessionGuard) {
  const scope = sessionReadScope(session);
  const guard = () => { if (scope !== sessionReadScope(session) || !activeSessionToken(session) || !isProfileSessionCurrent(isCurrent)) throw new WorkerControlException('session_scope_changed', ''); };
  const response = await authorizedFetch(session, '/v1/mobile/profile', {}, guard);
  if (isCurrent) guard();
  if (response.status !== 200) throw new Error('Profile fetch failed');
  const raw: unknown = await response.json();
  if (isCurrent) guard();
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new TypeError('Invalid profile');
  const row = raw as Record<string, unknown>;
  const profileData = profileFromLogin({ profile: row, capabilities: Array.isArray(row.capabilities) ? row.capabilities : [],
    assigned_apparatus: Array.isArray(row.assigned_apparatus) ? row.assigned_apparatus : [],
    assigned_apparatus_labels: row.assigned_apparatus_labels, assigned_item_groups: Array.isArray(row.assigned_item_groups) ? row.assigned_item_groups : [],
    assigned_warehouses: Array.isArray(row.assigned_warehouses) ? row.assigned_warehouses : [] });
  guard();
  if (isCurrent != null) assertProfileIdentity(session, profileData);
  const previous = new Set(session.assigned_apparatus), next = new Set(profileData.assigned_apparatus);
  const changed = previous.size !== next.size || [...previous].some(id => !next.has(id));
  if (!onlyWhenApparatusChanged || changed) {
    session.profile = profileData;
    session.capabilities = profileData.capabilities;
    session.assigned_apparatus = profileData.assigned_apparatus;
    session.assigned_apparatus_labels = profileData.assigned_apparatus_labels;
    session.assigned_item_groups = profileData.assigned_item_groups;
    session.assigned_warehouses = profileData.assigned_warehouses;
    await saveSession(session);
    if (isCurrent) guard();
  }
  return profileData;
}
