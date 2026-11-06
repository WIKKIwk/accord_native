import { File } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import type { Session } from '../auth';
import { gscalePhotoSearchSuggestion } from './gscalePhotoSearch';

/** Photo picking and 1600px/85% image preparation from WerkaAiSearchService. */
export async function pickGScalePhotoSearch(session: Session, source: 'camera' | 'library') {
  let result: ImagePicker.ImagePickerResult;
  try {
    if (source === 'camera' && !(await ImagePicker.requestCameraPermissionsAsync()).granted) throw new Error('image_pick_failed');
    result = source === 'camera' ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.85 })
      : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.85 });
  } catch { throw new Error('image_pick_failed'); }
  if (result.canceled || !result.assets.length) return null;
  const asset = result.assets[0];
  let context: ReturnType<typeof ImageManipulator.manipulate> | undefined;
  let image: Awaited<ReturnType<ReturnType<typeof ImageManipulator.manipulate>['renderAsync']>> | undefined;
  let outputUri = '';
  let bytes: Uint8Array;
  try {
    context = ImageManipulator.manipulate(asset.uri, { maxWidth: 1600 });
    image = await context.renderAsync();
    outputUri = (await image.saveAsync({ format: SaveFormat.JPEG, compress: 0.85 })).uri;
    bytes = await new File(outputUri).bytes();
  } catch { throw new Error('image_pick_failed'); }
  finally {
    try { image?.release(); } catch { /* The OS may already have released it. */ }
    try { context?.release(); } catch { /* The OS may already have released it. */ }
    if (outputUri) try { new File(outputUri).delete(); } catch { /* The OS may clear its temporary cache. */ }
  }
  return gscalePhotoSearchSuggestion(session, bytes, asset.fileName || 'werka-ai-search.jpg');
}
