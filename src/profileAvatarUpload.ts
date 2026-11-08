import { File } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { Platform } from 'react-native';
import { activeSessionToken, type Session } from './auth';
import { initialProfileSnapshot, type ProfileSnapshot } from './profileModel';
import { uploadAvatar } from './shared/profileApi';
import { cacheProfileAvatarBytes } from './shared/profileAvatarRuntime';
import { isProfileSessionCurrent, type ProfileSessionGuard } from './shared/profileSessionGuard';

export class AvatarUploadError extends Error {}

/** Normalize photos, including HEIC, to the server's supported JPEG format. */
export async function uploadProfileAvatar(session: Session, uri: string, signal: AbortSignal, filename?: string, isCurrent?: ProfileSessionGuard): Promise<ProfileSnapshot> {
  if (!activeSessionToken(session) || signal.aborted || !isProfileSessionCurrent(isCurrent)) throw new AvatarUploadError('Sessiya tugagan. Qayta kiring.');

  let stage: 'prepare' | 'file' | 'upload' = 'prepare';
  let context: ReturnType<typeof ImageManipulator.manipulate> | undefined;
  let image: Awaited<ReturnType<ReturnType<typeof ImageManipulator.manipulate>['renderAsync']>> | undefined;
  let outputUri: string | undefined;
  try {
    context = ImageManipulator.manipulate(uri, { maxWidth: 1000, maxHeight: 1000 });
    image = await context.renderAsync();
    const output = await image.saveAsync({ format: SaveFormat.JPEG, compress: 0.82 });
    outputUri = output.uri;
    if (!activeSessionToken(session) || signal.aborted || !isProfileSessionCurrent(isCurrent)) throw new AvatarUploadError('Sessiya tugagan. Qayta kiring.');

    stage = 'file';
    const bytes = Platform.OS === 'web'
      ? new Uint8Array(await (await fetch(output.uri)).arrayBuffer())
      : await new File(output.uri).bytes();
    if (!bytes.length) throw new AvatarUploadError('Rasmni o‘qib bo‘lmadi. Boshqa rasm tanlang.');

    if (!activeSessionToken(session) || signal.aborted || !isProfileSessionCurrent(isCurrent)) throw new AvatarUploadError('Sessiya tugagan. Qayta kiring.');
    stage = 'upload';
    if (isCurrent) await uploadAvatar(session, bytes, filename || new File(uri).name || 'avatar.jpg', signal, isCurrent);
    else await uploadAvatar(session, bytes, filename || new File(uri).name || 'avatar.jpg', signal);
    if (!activeSessionToken(session) || signal.aborted || !isProfileSessionCurrent(isCurrent)) throw new AvatarUploadError('Sessiya tugagan. Qayta kiring.');
    if (isCurrent) cacheProfileAvatarBytes(session, session.profile, bytes, isCurrent);
    else cacheProfileAvatarBytes(session, session.profile, bytes);
    return initialProfileSnapshot(session);
  } catch (error) {
    if (error instanceof AvatarUploadError) throw error;
    logUploadFailure(stage, error);
    if (stage === 'prepare' || stage === 'file') throw new AvatarUploadError('Rasmni tayyorlab bo‘lmadi. Boshqa rasm tanlab ko‘ring.');
    throw new AvatarUploadError('Serverga ulanib bo‘lmadi. Internetni tekshirib, qayta urinib ko‘ring.');
  } finally {
    // Cleanup must not turn an already successful server upload into a failure.
    try { image?.release(); } catch { /* The native object may already be released. */ }
    try { context?.release(); } catch { /* The native object may already be released. */ }
    if (outputUri && Platform.OS !== 'web') {
      try { new File(outputUri).delete(); } catch { /* The OS can also clear cached files. */ }
    } else if (outputUri && Platform.OS === 'web') {
      try { URL.revokeObjectURL(outputUri); } catch { /* The browser can clear cached files. */ }
    }
  }
}

function logUploadFailure(stage: string, error: unknown) {
  if (typeof __DEV__ === 'undefined' || !__DEV__) return;
  const name = error instanceof Error && /^[a-zA-Z0-9_]{1,40}$/.test(error.name) ? error.name : 'UnknownError';
  const value = error && typeof error === 'object' && 'code' in error ? error.code : undefined;
  const code = typeof value === 'string' && /^[a-zA-Z0-9_.-]{1,80}$/.test(value) ? value : 'unknown';
  // Do not log photos, local paths, tokens, or server responses.
  console.warn(`[profile-avatar] ${stage}: ${name} (${code})`);
}
