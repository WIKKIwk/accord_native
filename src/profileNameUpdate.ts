import { activeSessionToken, type Session } from './auth';
import { initialProfileSnapshot, type ProfileSnapshot } from './profileModel';
import { updateNickname } from './shared/profileApi';

export class ProfileNameError extends Error {}

export async function updateProfileName(session: Session, name: string, signal: AbortSignal): Promise<ProfileSnapshot> {
  if (!activeSessionToken(session) || signal.aborted) throw new ProfileNameError('Sessiya tugagan.');
  try {
    await updateNickname(session, name.trim(), signal);
    if (!activeSessionToken(session) || signal.aborted) throw new ProfileNameError('Sessiya tugagan.');
    return initialProfileSnapshot(session);
  } catch (error) {
    if (error instanceof ProfileNameError) throw error;
    throw new ProfileNameError('Ismni saqlab bo‘lmadi. Qayta urinib ko‘ring.');
  }
}
