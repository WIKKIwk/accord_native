import * as Crypto from 'expo-crypto';
import { File, UploadType } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import { activeSessionToken, type Session } from './auth';
import { authorizedFetch } from './authorizedFetch';
import { parseChatMessage, type ChatAttachment, type ChatMessage } from './chatModel';

const MAX_IMAGE_BYTES = 15 * 1024 * 1024;

export type ChatImageSource = 'library' | 'camera';
export type PickedChatImage = {
  uri: string;
  width: number;
  height: number;
  fileName: string;
  contentType: string;
  sizeBytes: number;
};

function object(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function conversationPath(conversationId: string): string {
  const id = conversationId.trim();
  if (!id || id === '.' || id === '..') throw new Error('Suhbat topilmadi.');
  return `/v1/mobile/chat/conversations/${encodeURIComponent(id)}`;
}

/** Only the same HTTPS origin may receive the session token for a media request. */
function mediaUrl(session: Session, path: string): string {
  const base = new URL(session.baseUrl);
  const url = new URL(path, base.origin);
  if (base.protocol !== 'https:' || url.origin !== base.origin) throw new Error('Media manzili noto‘g‘ri.');
  return url.toString();
}

export async function pickChatImage(source: ChatImageSource): Promise<PickedChatImage | null> {
  const permission = source === 'camera'
    ? await ImagePicker.requestCameraPermissionsAsync()
    : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    throw new Error(source === 'camera' ? 'Kameraga ruxsat berilmagan.' : 'Galereyaga ruxsat berilmagan.');
  }
  const options: ImagePicker.ImagePickerOptions = {
    mediaTypes: ['images'], allowsEditing: false, quality: 0.8, exif: false, selectionLimit: 1,
    // The backend decodes JPEG/PNG/WebP only; let iOS transcode HEIC originals.
    preferredAssetRepresentationMode: ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
  };
  const result = source === 'camera'
    ? await ImagePicker.launchCameraAsync(options)
    : await ImagePicker.launchImageLibraryAsync(options);
  const asset = result.canceled ? null : result.assets?.[0];
  if (!asset) return null;
  const file = new File(asset.uri);
  const sizeBytes = asset.fileSize && asset.fileSize > 0 ? asset.fileSize : file.size;
  if (!sizeBytes) throw new Error('Rasm hajmini aniqlab bo‘lmadi.');
  if (sizeBytes > MAX_IMAGE_BYTES) throw new Error('Rasm 15 MB dan katta bo‘lmasligi kerak.');
  const extension = (text(asset.mimeType).split('/')[1] || 'jpg').replace('jpeg', 'jpg');
  return {
    uri: asset.uri, width: asset.width, height: asset.height,
    fileName: text(asset.fileName) || `rasm-${Date.now()}.${extension}`,
    contentType: text(asset.mimeType) || 'image/jpeg',
    sizeBytes,
  };
}

type UploadInstruction = { url: string; headers: Record<string, string>; strategy: string; expiresAtUnix: number };
type MediaUpload = { mediaId: string; uploadId: string; instruction: UploadInstruction };

function parseInitialization(value: unknown): MediaUpload {
  const payload = object(value);
  const media = object(payload.media);
  const upload = object(payload.upload);
  const rawHeaders = object(upload.headers);
  const headers: Record<string, string> = {};
  for (const [key, header] of Object.entries(rawHeaders)) {
    if (typeof header === 'string') headers[key] = header;
  }
  const mediaId = text(media.media_id);
  const uploadId = text(media.upload_id);
  const url = text(upload.url);
  if (!mediaId || !uploadId || !url) throw new Error('Server yuklash manzilini qaytarmadi.');
  return {
    mediaId, uploadId,
    instruction: { url, headers, strategy: text(upload.strategy), expiresAtUnix: typeof upload.expires_at_unix === 'number' ? upload.expires_at_unix : 0 },
  };
}

export async function uploadChatImage(
  session: Session,
  conversationId: string,
  image: PickedChatImage,
  onProgress?: (progress: number) => void,
): Promise<{ mediaId: string; width: number; height: number }> {
  const token = activeSessionToken(session);
  if (!token) throw new Error('Sessiya tugagan. Qayta kiring.');
  const path = `${conversationPath(conversationId)}/media/uploads`;
  const initialized = await authorizedFetch(session, path, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_upload_id: `v4_${Crypto.randomUUID()}`,
      kind: 'image',
      filename: image.fileName,
      content_type: image.contentType,
      size_bytes: image.sizeBytes,
    }),
  });
  if (!initialized.ok) throw new Error(initialized.status === 413 ? 'Rasm hajmi server uchun katta.' : 'Rasm yuklashni boshlab bo‘lmadi.');
  const upload = parseInitialization(await initialized.json());
  if (upload.instruction.strategy !== 'local_proxy') throw new Error('Server yuklash usuli qo‘llab-quvvatlanmaydi.');

  const headers: Record<string, string> = { ...upload.instruction.headers };
  for (const key of Object.keys(headers)) {
    if (key.toLowerCase() === 'authorization') delete headers[key];
  }
  headers.Authorization = `Bearer ${activeSessionToken(session) ?? token}`;
  headers['content-type'] = image.contentType;

  const task = new File(image.uri).createUploadTask(mediaUrl(session, upload.instruction.url), {
    httpMethod: 'PUT', uploadType: UploadType.BINARY_CONTENT, headers, mimeType: image.contentType,
    onProgress: ({ bytesSent, totalBytes }) => onProgress?.(totalBytes > 0 ? Math.min(1, bytesSent / totalBytes) : 0),
  });
  const result = await task.uploadAsync();
  if (result.status < 200 || result.status >= 300) throw new Error(`Rasm yuklanmadi (${result.status}).`);
  onProgress?.(1);

  const completed = await authorizedFetch(session, `${path}/${encodeURIComponent(upload.uploadId)}/complete`, { method: 'POST' });
  if (!completed.ok) throw new Error('Rasm yuklanishini tasdiqlab bo‘lmadi.');
  const media = object(object(await completed.json()).media);
  return {
    mediaId: text(media.media_id) || upload.mediaId,
    width: typeof media.width_pixels === 'number' ? media.width_pixels : image.width,
    height: typeof media.height_pixels === 'number' ? media.height_pixels : image.height,
  };
}

export async function sendChatImage(
  session: Session,
  conversationId: string,
  mediaId: string,
  caption = '',
): Promise<ChatMessage> {
  const clientMessageId = `v4_${Crypto.randomUUID()}`;
  const body = caption.trim().slice(0, 4000);
  const response = await authorizedFetch(session, `${conversationPath(conversationId)}/messages`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ client_message_id: clientMessageId, body, media_id: mediaId }),
  });
  if (!response.ok) throw new Error(response.status === 403 ? 'Bu suhbatga rasm yuborish mumkin emas.' : 'Rasm yuborilmadi.');
  const payload = object(await response.json());
  const message = parseChatMessage(payload.message, conversationId);
  if (!message || message.clientMessageId !== clientMessageId || message.attachment?.mediaId !== mediaId) {
    throw new Error('Rasm xabari tasdiqlanmadi.');
  }
  return message;
}

/** Authenticated source for `expo-image`; never send the token to another origin. */
export function chatMediaImageSource(session: Session, attachment: ChatAttachment) {
  const token = activeSessionToken(session);
  if (!token || attachment.kind !== 'image') return null;
  try {
    return { uri: mediaUrl(session, attachment.contentUrl), headers: { Authorization: `Bearer ${token}` } };
  } catch {
    return null;
  }
}
