import { Asset, AssetField, MediaType, Query, getPermissionsAsync, requestPermissionsAsync } from 'expo-media-library';
import { prepareChatMedia, type ChatMediaDraft } from './chatMedia';

export type RecentChatPhoto = { id: string; filename: string; width: number; height: number };
export type RecentChatPhotosResult = { photos: RecentChatPhoto[]; granted: boolean; canAskAgain: boolean; requested: boolean };

export async function recentChatPhotos(requestPermission = false): Promise<RecentChatPhotosResult> {
  let permission = await getPermissionsAsync(false, ['photo']);
  let requested = false;
  if (!permission.granted && requestPermission && permission.canAskAgain) {
    requested = true;
    permission = await requestPermissionsAsync(false, ['photo']);
  }
  if (!permission.granted) return { photos: [], granted: false, canAskAgain: permission.canAskAgain, requested };
  const assets = await new Query().eq(AssetField.MEDIA_TYPE, MediaType.IMAGE)
    .orderBy({ key: AssetField.CREATION_TIME, ascending: false }).limit(4).exeForMetadata();
  const photos = assets.filter(asset => asset.id.startsWith('ph://')).map(asset => ({
    id: asset.id, filename: asset.filename ?? 'rasm', width: asset.width ?? 0, height: asset.height ?? 0,
  }));
  return { photos, granted: true, canAskAgain: permission.canAskAgain, requested };
}

export async function prepareRecentChatPhoto(photo: RecentChatPhoto): Promise<ChatMediaDraft> {
  const uri = await new Asset(photo.id).getUri();
  if (!uri.startsWith('file://')) throw new Error('Rasmni o‘qib bo‘lmadi. Qayta urinib ko‘ring.');
  const extension = uri.split(/[?#]/)[0].match(/\.([a-zA-Z0-9]+)$/)?.[1];
  const filename = extension ? `rasm.${extension}` : photo.filename;
  return prepareChatMedia({ uri, type: 'image', fileName: filename, width: photo.width, height: photo.height });
}
