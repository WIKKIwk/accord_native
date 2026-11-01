import { activeSessionToken, type Session } from './auth';
import { authorizedFetch } from './authorizedFetch';
import { profileSnapshotFromResponse, type ProfileSnapshot } from './profileModel';

export class ProfileNameError extends Error {}

export async function updateProfileName(session: Session, name: string, signal: AbortSignal): Promise<ProfileSnapshot> {
  const nickname = name.trim();
  if (!nickname) throw new ProfileNameError('Ismni kiriting.');
  if (!activeSessionToken(session) || signal.aborted) throw new ProfileNameError('Sessiya tugagan.');

  const response = await authorizedFetch(session, '/v1/mobile/profile', {
    method: 'PUT', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nickname }), signal,
  });
  if (!response.ok) throw new ProfileNameError('Ismni saqlab bo‘lmadi. Qayta urinib ko‘ring.');
  const snapshot = profileSnapshotFromResponse(session, await response.json());
  if (!activeSessionToken(session) || signal.aborted || !snapshot || snapshot.profile.display_name !== nickname) {
    throw new ProfileNameError('Server ismni tasdiqlamadi. Qayta urinib ko‘ring.');
  }
  return snapshot;
}
