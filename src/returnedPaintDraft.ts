import { File, Paths } from 'expo-file-system';
import { Platform } from 'react-native';
import type { ReturnedPaintImage } from './boyoqchi/returnedPaintModel';

export type ReturnedPaintDraft = {
  values: Record<string, string>;
  fields: Record<string, string[]>;
  usage: 'rasxot' | 'astatka';
  imageId: string;
  image?: ReturnedPaintImage | null;
};

const fileName = 'returned-paint-drafts-v1.json';
let pending: Promise<unknown> = Promise.resolve();

function serialized<T>(work: () => Promise<T>): Promise<T> {
  const next = pending.then(work);
  pending = next.catch(() => {});
  return next;
}

async function readAll(): Promise<Record<string, ReturnedPaintDraft>> {
  let text: string | null;
  if (Platform.OS === 'web') text = globalThis.localStorage?.getItem(fileName) ?? null;
  else {
    const file = new File(Paths.document, fileName);
    text = file.exists ? await file.text() : null;
  }
  if (!text) return {};
  const data: unknown = JSON.parse(text);
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('Bo‘yoq ma’lumotlarini o‘qib bo‘lmadi.');
  return data as Record<string, ReturnedPaintDraft>;
}

async function writeAll(drafts: Record<string, ReturnedPaintDraft>) {
  const text = JSON.stringify(drafts);
  if (Platform.OS === 'web') globalThis.localStorage?.setItem(fileName, text);
  else await new File(Paths.document, fileName).write(text);
}

export function loadReturnedPaintDraft(scope: string): Promise<ReturnedPaintDraft | null> {
  return serialized(async () => {
    const draft = (await readAll())[scope];
    if (!draft || typeof draft !== 'object') return null;
    const entries = draft.values && typeof draft.values === 'object' && !Array.isArray(draft.values) ? Object.entries(draft.values) : [];
    const fields = draft.fields && typeof draft.fields === 'object' && !Array.isArray(draft.fields) ? Object.entries(draft.fields) : [];
    const image = draft.image;
    const savedImage = image && typeof image === 'object' && image.image_id === draft.imageId &&
      [image.image_name, image.image_mime, image.image_url].every(value => typeof value === 'string') &&
      typeof image.image_size_bytes === 'number' && Number.isFinite(image.image_size_bytes) ? image : null;
    return {
      values: Object.fromEntries(entries.filter((entry): entry is [string, string] => typeof entry[1] === 'string')),
      fields: Object.fromEntries(fields.filter((entry): entry is [string, string[]] => Array.isArray(entry[1]) && entry[1].every(value => typeof value === 'string'))),
      usage: draft.usage === 'astatka' ? 'astatka' : 'rasxot',
      imageId: typeof draft.imageId === 'string' ? draft.imageId : '',
      ...(savedImage ? { image: savedImage } : {}),
    };
  });
}

export function saveReturnedPaintDraft(scope: string, draft: ReturnedPaintDraft): Promise<void> {
  return serialized(async () => {
    const drafts = await readAll();
    if (Object.keys(draft.values).length || Object.values(draft.fields).some(fields => fields.length) || draft.imageId) drafts[scope] = draft;
    else delete drafts[scope];
    await writeAll(drafts);
  });
}
