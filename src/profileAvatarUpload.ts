import { File } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { Platform } from 'react-native';
import { activeSessionToken, type Session } from './auth';
import { authorizedFetch } from './authorizedFetch';
import { profileSnapshotFromResponse, type ProfileSnapshot } from './profileModel';

const MAX_IMAGE_BYTES = 5 * 1024 * 1024 - 16 * 1024; // Leave room for multipart headers.

export class AvatarUploadError extends Error {}

/** Normalize photos, including HEIC, to the server's supported JPEG format. */
export async function uploadProfileAvatar(session: Session, uri: string, signal: AbortSignal): Promise<ProfileSnapshot> {
  if (!activeSessionToken(session) || signal.aborted) throw new AvatarUploadError('Sessiya tugagan. Qayta kiring.');

  let stage: 'prepare' | 'file' | 'upload' | 'response' = 'prepare';
  let context: ReturnType<typeof ImageManipulator.manipulate> | undefined;
  let image: Awaited<ReturnType<ReturnType<typeof ImageManipulator.manipulate>['renderAsync']>> | undefined;
  let outputUri: string | undefined;
  try {
    context = ImageManipulator.manipulate(uri, { maxWidth: 1000, maxHeight: 1000 });
    image = await context.renderAsync();
    const output = await image.saveAsync({ format: SaveFormat.JPEG, compress: 0.82 });
    outputUri = output.uri;
    if (!activeSessionToken(session) || signal.aborted) throw new AvatarUploadError('Sessiya tugagan. Qayta kiring.');

    stage = 'file';
    const form = new FormData();
    if (Platform.OS === 'web') {
      const blob = await (await fetch(output.uri)).blob();
      checkSize(blob.size);
      form.append('avatar', blob, 'avatar.jpg');
    } else {
      // Expo SDK 58's fetch accepts File/Blob parts, not React Native's { uri } object.
      const file = new File(output.uri);
      checkSize(file.size);
      form.append('avatar', file);
    }

    if (!activeSessionToken(session) || signal.aborted) throw new AvatarUploadError('Sessiya tugagan. Qayta kiring.');
    stage = 'upload';
    const response = await authorizedFetch(session, '/v1/mobile/profile/avatar', { method: 'POST', body: form, signal });
    if (!response.ok) throw new AvatarUploadError('Server rasmni qabul qilmadi. Qayta urinib ko‘ring.');
    stage = 'response';
    const snapshot = profileSnapshotFromResponse(session, await response.json());
    if (!activeSessionToken(session) || signal.aborted || !snapshot || typeof snapshot.profile.avatar_url !== 'string' || !snapshot.profile.avatar_url.trim()) {
      throw new AvatarUploadError('Server rasmni tasdiqlamadi. Qayta urinib ko‘ring.');
    }
    return snapshot;
  } catch (error) {
    if (error instanceof AvatarUploadError) throw error;
    logUploadFailure(stage, error);
    if (stage === 'prepare' || stage === 'file') throw new AvatarUploadError('Rasmni tayyorlab bo‘lmadi. Boshqa rasm tanlab ko‘ring.');
    if (stage === 'response') throw new AvatarUploadError('Server javobini o‘qib bo‘lmadi. Qayta urinib ko‘ring.');
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

function checkSize(size: number) {
  if (!size) throw new AvatarUploadError('Rasmni o‘qib bo‘lmadi. Boshqa rasm tanlang.');
  if (size > MAX_IMAGE_BYTES) throw new AvatarUploadError('Rasm juda katta. Kichikroq rasm tanlang.');
}
