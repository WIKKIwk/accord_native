import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { MobileApiException } from './shared/mobileApiException';

/** @v2 _ReturnedPaintSheetState */
export async function selectWorkerReturnedPaintPhoto(source: 'camera' | 'gallery', current: () => boolean) {
  if (!current()) return null;
  if (source === 'camera') {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!current()) return null;
    if (!permission.granted) throw new Error('camera_permission_denied');
  }
  const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.84 };
  const result = source === 'camera' ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
  if (!current() || result.canceled) return null;
  return result.assets[0] ?? null;
}

export async function prepareWorkerReturnedPaintPhoto(asset: ImagePicker.ImagePickerAsset, current: () => boolean) {
  let uri = asset.uri;
  const suppliedMime = asset.mimeType?.trim().toLowerCase() ?? '';
  let mime = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'].includes(suppliedMime)
    ? suppliedMime : imageMime(asset.fileName ?? uri);
  let filename = asset.fileName ?? uri.split('/').pop() ?? '';
  // Flutter's picker bounds both dimensions at 1800. Keep the native picker,
  // then apply that bound through the installed Expo image module if needed.
  if (Math.max(asset.width, asset.height) > 1800) {
    const format = mime === 'image/png' ? SaveFormat.PNG : mime === 'image/webp' ? SaveFormat.WEBP : SaveFormat.JPEG;
    const context = ImageManipulator.manipulate(uri);
    context.resize(asset.width >= asset.height ? { width: 1800 } : { height: 1800 });
    const image = await context.renderAsync();
    const resized = await image.saveAsync({ compress: 0.84, format });
    if (!current()) return null;
    uri = resized.uri;
    mime = format === SaveFormat.PNG ? 'image/png' : format === SaveFormat.WEBP ? 'image/webp' : 'image/jpeg';
    filename = filename.replace(/\.[^.]*$/, '') + (format === SaveFormat.PNG ? '.png' : format === SaveFormat.WEBP ? '.webp' : '.jpg');
  }
  if (!current()) return null;
  const bytes = new Uint8Array(await (await fetch(uri)).arrayBuffer());
  if (!current()) return null;
  if (!bytes.length) throw new MobileApiException({ code: 'returned_paint_image_empty', message: 'Tanlangan rasm bo‘sh' });
  if (bytes.length > 6 * 1024 * 1024) throw new MobileApiException({ code: 'returned_paint_image_too_large', message: 'Rasm hajmi 6 MB dan oshmasligi kerak' });
  return { bytes, mime, filename };
}

function imageMime(name: string): string {
  const extension = name.toLowerCase().split('.').pop();
  return ({ png: 'image/png', webp: 'image/webp', heic: 'image/heic', heif: 'image/heif' } as Record<string, string>)[extension ?? ''] ?? 'image/jpeg';
}
