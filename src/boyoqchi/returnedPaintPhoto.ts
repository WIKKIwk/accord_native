import * as Crypto from 'expo-crypto';
import { Directory, File, Paths } from 'expo-file-system';
import { Asset, requestPermissionsAsync } from 'expo-media-library';
import type { Session } from '../auth';
import { downloadReturnedPaintImage } from './returnedPaintApi';
import type { ReturnedPaintImage } from './returnedPaintModel';

function downloadName(image: ReturnedPaintImage): string {
  const name = image.image_name.trim().split(/[\\/]/).pop()?.replace(/[\x00-\x1f\x7f]/g, '') ?? '';
  if (name && name !== '.' && name !== '..') return name;
  const ext = ({ 'image/png': 'png', 'image/webp': 'webp', 'image/heic': 'heic', 'image/heif': 'heif' } as Record<string, string>)[image.image_mime.trim().toLowerCase()] ?? 'jpg';
  return `qaytarilgan-boyoq.${ext}`;
}

/** Download first, then request only add access when the user chooses Save. */
export async function saveReturnedPaintImageToPhotos(session: Session, image: ReturnedPaintImage): Promise<void> {
  const bytes = await downloadReturnedPaintImage(session, image);
  const permission = await requestPermissionsAsync(true);
  if (!permission.granted) throw new Error('photo_permission_denied');
  const directory = new Directory(Paths.cache, `returned-paint-${Crypto.randomUUID()}`);
  try {
    directory.create({ intermediates: true, idempotent: true });
    const file = new File(directory, downloadName(image));
    file.create({ overwrite: true });
    await file.write(bytes);
    await Asset.create(file.uri);
  } finally {
    if (directory.exists) { try { directory.delete(); } catch { /* Temporary cache may already be gone. */ } }
  }
}
