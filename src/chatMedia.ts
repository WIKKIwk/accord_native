import * as Crypto from 'expo-crypto';
import { File, FileMode } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import type { ImagePickerAsset } from 'expo-image-picker';
import { activeSessionToken, type Session } from './auth';
import { authorizedFetch } from './authorizedFetch';
import { isMyChatMessage, parseChatMessage, type ChatMessage } from './chatModel';

type MediaKind = 'image' | 'video';
export type ChatMediaDraft = {
  uri: string; kind: MediaKind; filename: string; contentType: string; sizeBytes: number;
  durationMs?: number; temporary: boolean; clientUploadId: string; clientMessageId: string;
  uploadId?: string; mediaId?: string;
};
type MediaStatus = { mediaId: string; uploadId: string; status: string; mode: string; chunks: number[] };
type UploadInstruction = { strategy: string; method: string; url: string; headers: Record<string, string>; chunkSize: number; totalChunks: number };

const MAX_IMAGE_BYTES = 15 * 1024 * 1024;
const MAX_VIDEO_BYTES = 2 * 1024 * 1024 * 1024;
const MAX_VIDEO_DURATION_MS = 600_000;
const MAX_CHUNK_BYTES = 64 * 1024 * 1024;
const validId = (value: string) => /^[A-Za-z0-9_.-]{1,128}$/.test(value) && value !== '.' && value !== '..';
const object = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
const string = (value: unknown) => typeof value === 'string' ? value.trim() : '';

function mediaType(kind: MediaKind, mime: string, name: string): string {
  const value = mime.trim().toLowerCase();
  const allowed = kind === 'image' ? ['image/jpeg', 'image/png', 'image/webp'] : ['video/mp4', 'video/quicktime', 'video/webm'];
  if (allowed.includes(value)) return value;
  const suffix = name.toLowerCase().split('.').pop();
  if (kind === 'image') return suffix === 'jpg' || suffix === 'jpeg' ? 'image/jpeg' : suffix === 'png' ? 'image/png' : suffix === 'webp' ? 'image/webp' : '';
  return suffix === 'mp4' || suffix === 'm4v' ? 'video/mp4' : suffix === 'mov' ? 'video/quicktime' : suffix === 'webm' ? 'video/webm' : '';
}

/** Prepare a picker result without sending it; the user confirms from the composer. */
export async function prepareChatMedia(asset: ImagePickerAsset): Promise<ChatMediaDraft> {
  const kind = asset.type === 'video' ? 'video' : asset.type === 'image' ? 'image' : null;
  if (!kind || !asset.uri) throw new Error('Rasm yoki video tanlang.');
  let uri = asset.uri;
  let filename = (asset.fileName ?? '').trim().replace(/[\x00-\x1f\x7f]/g, '_').slice(-240);
  let contentType = mediaType(kind, asset.mimeType ?? '', filename);
  let temporary = false;
  if (kind === 'image' && !contentType) {
    const context = ImageManipulator.manipulate(uri);
    let image: Awaited<ReturnType<typeof context.renderAsync>> | undefined;
    try {
      image = await context.renderAsync();
      uri = (await image.saveAsync({ format: SaveFormat.JPEG, compress: 0.9 })).uri;
      contentType = 'image/jpeg';
      filename = 'rasm.jpg';
      temporary = true;
    } finally {
      try { image?.release(); } catch { /* Released by the native runtime. */ }
      try { context.release(); } catch { /* Released by the native runtime. */ }
    }
  }
  try {
    if (!contentType) throw new Error('Faqat MP4, MOV yoki WebM video yuborish mumkin.');
    const file = new File(uri);
    const sizeBytes = file.size;
    if (!file.exists || !Number.isSafeInteger(sizeBytes) || sizeBytes <= 0) throw new Error('Faylni o‘qib bo‘lmadi.');
    if (sizeBytes > (kind === 'image' ? MAX_IMAGE_BYTES : MAX_VIDEO_BYTES)) {
      throw new Error(kind === 'image' ? 'Rasm 15 MiB dan oshmasligi kerak.' : 'Video 2 GiB dan oshmasligi kerak.');
    }
    const durationMs = kind === 'video' && typeof asset.duration === 'number' && asset.duration > 0 ? Math.round(asset.duration) : undefined;
    if (durationMs && durationMs > MAX_VIDEO_DURATION_MS) throw new Error('Video 10 daqiqadan oshmasligi kerak.');
    if (!filename) filename = kind === 'image' ? 'rasm.jpg' : 'video.mp4';
    return { uri, kind, filename, contentType, sizeBytes, durationMs, temporary,
      clientUploadId: `client_upload_${Crypto.randomUUID()}`, clientMessageId: `client_${Crypto.randomUUID()}` };
  } catch (error) {
    if (temporary) { try { new File(uri).delete(); } catch { /* Cache cleanup is best effort. */ } }
    throw error;
  }
}

export function discardChatMedia(draft: ChatMediaDraft): void {
  if (draft.temporary) { try { new File(draft.uri).delete(); } catch { /* Cache cleanup is best effort. */ } }
}

function assertActive(session: Session, signal: AbortSignal) {
  if (signal.aborted || !activeSessionToken(session)) throw new Error('Yuborish to‘xtatildi. Qayta urinib ko‘ring.');
}

function paths(conversationId: string, uploadId?: string) {
  if (!validId(conversationId) || (uploadId && !validId(uploadId))) throw new Error('Suhbat ma’lumoti noto‘g‘ri.');
  const root = `/v1/mobile/chat/conversations/${encodeURIComponent(conversationId)}`;
  return { root, uploads: `${root}/media/uploads`, upload: uploadId ? `${root}/media/uploads/${encodeURIComponent(uploadId)}` : '' };
}

async function jsonResponse(response: Response): Promise<Record<string, unknown>> {
  if (!response.ok) {
    if (response.status === 413) throw new Error('Fayl hajmi ruxsat etilgan chegaradan katta.');
    if (response.status === 422) throw new Error('Media faylni qayta ishlab bo‘lmadi.');
    if (response.status === 401 || response.status === 403) throw new Error('Sessiyani tekshirib, qayta urinib ko‘ring.');
    throw new Error('Media yuborilmadi. Qayta urinib ko‘ring.');
  }
  return object(await response.json());
}

function parseStatus(value: unknown, conversationId: string, draft: ChatMediaDraft): MediaStatus {
  const row = object(value);
  const mediaId = string(row.media_id), uploadId = string(row.upload_id);
  if (!validId(mediaId) || !validId(uploadId) || string(row.conversation_id) !== conversationId ||
      string(row.kind) !== draft.kind || row.size_bytes !== draft.sizeBytes ||
      string(row.client_upload_id) !== draft.clientUploadId ||
      (draft.uploadId && draft.uploadId !== uploadId) || (draft.mediaId && draft.mediaId !== mediaId)) {
    throw new Error('Server media ma’lumotini tasdiqlamadi.');
  }
  const chunks = Array.isArray(row.uploaded_chunks) ? row.uploaded_chunks.map(item => object(item).chunk_index) : [];
  if (chunks.some(value => typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0)) throw new Error('Media qismlari noto‘g‘ri.');
  return { mediaId, uploadId, status: string(row.status), mode: string(row.upload_mode), chunks: chunks as number[] };
}

function parseInstruction(value: unknown): UploadInstruction {
  const row = object(value), rawHeaders = object(row.headers);
  const headers: Record<string, string> = {};
  for (const [key, value] of Object.entries(rawHeaders)) if (typeof value === 'string') headers[key] = value;
  return { strategy: string(row.strategy), method: string(row.method), url: string(row.url), headers,
    chunkSize: Number(row.chunk_size_bytes) || 0, totalChunks: Number(row.total_chunks) || 0 };
}

async function readRange(file: File, offset: number, length: number, session: Session, signal: AbortSignal): Promise<ArrayBuffer> {
  const handle = file.open(FileMode.ReadOnly);
  try {
    handle.offset = offset;
    const bytes = new Uint8Array(length);
    let read = 0;
    while (read < length) {
      assertActive(session, signal);
      const part = await handle.readBytes(length - read);
      if (!part.length) throw new Error('Faylni o‘qib bo‘lmadi.');
      bytes.set(part, read);
      read += part.length;
    }
    return bytes.buffer;
  } finally { handle.close(); }
}

function apiUploadPath(session: Session, raw: string, expected: string): string {
  const uri = new URL(raw, session.baseUrl);
  if (uri.protocol !== 'https:' || uri.origin !== session.baseUrl || uri.pathname !== expected || uri.search || uri.hash) {
    throw new Error('Server yuklash manzili noto‘g‘ri.');
  }
  return uri.pathname;
}

function delay(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) { reject(new Error('Yuborish to‘xtatildi.')); return; }
    const timer = setTimeout(() => { signal.removeEventListener('abort', abort); resolve(); }, ms);
    const abort = () => { clearTimeout(timer); reject(new Error('Yuborish to‘xtatildi.')); };
    signal.addEventListener('abort', abort, { once: true });
  });
}

function resetFailedUpload(draft: ChatMediaDraft) {
  draft.uploadId = undefined;
  draft.mediaId = undefined;
  draft.clientUploadId = `client_upload_${Crypto.randomUUID()}`;
}

/** Uploads images or resumable video chunks using the V2 backend contract. */
export async function sendChatMedia(session: Session, conversationId: string, draft: ChatMediaDraft, caption: string,
  signal: AbortSignal, onProgress: (label: string) => void): Promise<ChatMessage> {
  const text = caption.trim();
  if (Array.from(text).length > 4000) throw new Error('Xabar matni juda uzun.');
  assertActive(session, signal);
  const file = new File(draft.uri);
  if (!file.exists || file.size !== draft.sizeBytes) throw new Error('Fayl topilmadi. Uni qayta tanlang.');
  const root = paths(conversationId);
  let status: MediaStatus | undefined;
  let instruction: UploadInstruction | undefined;
  const initialize = async () => {
    const response = await authorizedFetch(session, root.uploads, { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_upload_id: draft.clientUploadId, kind: draft.kind, filename: draft.filename,
        content_type: draft.contentType, size_bytes: draft.sizeBytes, ...(draft.durationMs ? { duration_ms: draft.durationMs } : {}) }), signal });
    const payload = await jsonResponse(response);
    const current = parseStatus(payload.media, conversationId, draft);
    draft.uploadId = current.uploadId;
    draft.mediaId = current.mediaId;
    return { current, instruction: parseInstruction(payload.upload) };
  };
  if (draft.uploadId) {
    const response = await authorizedFetch(session, paths(conversationId, draft.uploadId).upload, { signal });
    if (response.status === 404) resetFailedUpload(draft);
    else status = parseStatus((await jsonResponse(response)).media, conversationId, draft);
    if (status && (status.status === 'failed' || status.status === 'cancelled')) {
      resetFailedUpload(draft);
      status = undefined;
    }
  }
  if (!status || status.status === 'pending') {
    onProgress('Yuklanmoqda…');
    const initial = await initialize();
    status = initial.current;
    instruction = initial.instruction;
    if (status.status === 'pending') {
      const uploadPath = paths(conversationId, status.uploadId).upload;
      if (draft.kind === 'video' && status.mode === 'chunked' && instruction.strategy === 'resumable_chunks') {
        const size = instruction.chunkSize, total = instruction.totalChunks;
        if (!Number.isSafeInteger(size) || size <= 0 || size > MAX_CHUNK_BYTES || total !== Math.ceil(draft.sizeBytes / size) || instruction.method !== 'PUT') {
          throw new Error('Video yuklash parametrlari noto‘g‘ri.');
        }
        const sent = new Set(status.chunks);
        if ([...sent].some(index => index >= total)) throw new Error('Video qismlari noto‘g‘ri.');
        for (let index = 0; index < total; index++) {
          if (sent.has(index)) continue;
          const offset = index * size, length = Math.min(size, draft.sizeBytes - offset);
          const path = apiUploadPath(session, instruction.url.replace('{chunk_index}', String(index)), `${uploadPath}/chunks/${index}`);
          const bytes = await readRange(file, offset, length, session, signal);
          const response = await authorizedFetch(session, path, { method: 'PUT', headers: {
            'Content-Type': 'application/octet-stream', 'Content-Length': String(length),
            'Content-Range': `bytes ${offset}-${offset + length - 1}/${draft.sizeBytes}`,
          }, body: bytes, signal });
          status = parseStatus((await jsonResponse(response)).media, conversationId, draft);
          onProgress(`Yuklanmoqda… ${Math.round(((index + 1) / total) * 100)}%`);
        }
      } else if (draft.kind === 'image' && status.mode === 'single' && instruction.method === 'PUT') {
        const bytes = await readRange(file, 0, draft.sizeBytes, session, signal);
        const headers = new Headers(instruction.headers);
        headers.set('Content-Type', draft.contentType);
        headers.set('Content-Length', String(draft.sizeBytes));
        let response: Response;
        if (instruction.strategy === 'local_proxy') {
          response = await authorizedFetch(session, apiUploadPath(session, instruction.url, `${uploadPath}/content`), { method: 'PUT', headers, body: bytes, signal });
        } else if (instruction.strategy === 'direct_put') {
          const target = new URL(instruction.url);
          if (target.protocol !== 'https:' || target.username || target.password || target.hash) throw new Error('Server yuklash manzili noto‘g‘ri.');
          headers.delete('Authorization');
          response = await fetch(target.toString(), { method: 'PUT', headers, body: bytes, signal, redirect: 'error' });
        } else throw new Error('Rasm yuklash usuli qo‘llab-quvvatlanmaydi.');
        if (!response.ok) throw new Error('Rasm yuklanmadi. Qayta urinib ko‘ring.');
      } else throw new Error('Media yuklash usuli qo‘llab-quvvatlanmaydi.');
      assertActive(session, signal);
      const response = await authorizedFetch(session, `${uploadPath}/complete`, { method: 'POST', signal });
      status = parseStatus((await jsonResponse(response)).media, conversationId, draft);
    }
  }
  if (status.status === 'uploaded') {
    const response = await authorizedFetch(session, `${paths(conversationId, status.uploadId).upload}/complete`, { method: 'POST', signal });
    status = parseStatus((await jsonResponse(response)).media, conversationId, draft);
  }
  onProgress('Tayyorlanmoqda…');
  for (let attempt = 0; status.status === 'processing' && attempt < 300; attempt++) {
    await delay(2000, signal);
    const response = await authorizedFetch(session, paths(conversationId, status.uploadId).upload, { signal });
    status = parseStatus((await jsonResponse(response)).media, conversationId, draft);
  }
  if (status.status !== 'ready') {
    if (status.status === 'failed' || status.status === 'cancelled') resetFailedUpload(draft);
    throw new Error('Media tayyorlanmadi. Qayta urinib ko‘ring.');
  }
  assertActive(session, signal);
  onProgress('Yuborilmoqda…');
  const response = await authorizedFetch(session, `${root.root}/messages`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ client_message_id: draft.clientMessageId, body: text, media_id: status.mediaId }), signal });
  const raw = (await jsonResponse(response)).message;
  const message = parseChatMessage(raw, conversationId);
  if (!message || !isMyChatMessage(session, message) || message.clientMessageId !== draft.clientMessageId ||
      message.attachment?.mediaId !== status.mediaId || message.attachment.kind !== draft.kind || string(object(raw).body) !== text) {
    throw new Error('Yuborilgan media tasdiqlanmadi.');
  }
  return message;
}

/** Return a short-lived, server-scoped URL without exposing the session token. */
export async function chatMediaTicket(session: Session, mediaId: string, signal?: AbortSignal): Promise<string> {
  if (!validId(mediaId)) throw new Error('Media topilmadi.');
  const path = `/v1/mobile/chat/media/${encodeURIComponent(mediaId)}`;
  const response = await authorizedFetch(session, `${path}/playback-ticket`, { method: 'POST', signal });
  const payload = await jsonResponse(response);
  const url = new URL(string(payload.url), session.baseUrl);
  if (url.protocol !== 'https:' || url.origin !== session.baseUrl || url.pathname !== `${path}/content` || !url.searchParams.get('ticket') || url.hash) {
    throw new Error('Media manzili noto‘g‘ri.');
  }
  return url.toString();
}
