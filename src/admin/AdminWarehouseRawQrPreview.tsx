import { Image } from 'expo-image';
import { View } from 'react-native';
import type { adminWarehouseRawQrPreview } from './adminWarehouseRawQrModel';

/** Source RpsQrPreview:240 white card,16 padding,208 drawing area and four quiet modules. */
export function AdminWarehouseRawQrPreview({ preview, barcode }: { preview: ReturnType<typeof adminWarehouseRawQrPreview>; barcode: string }) {
  return <View testID={`raw-stock-qr-preview-${barcode}`} style={{ width: 240, height: 240, borderRadius: 18, backgroundColor: '#FFFFFF', padding: 16, alignSelf: 'center' }}>
    <View style={{ width: 208, height: 208, alignItems: 'center', justifyContent: 'center' }}><Image source={{ uri: preview.uri }} contentFit="fill" transition={0}
      style={{ width: preview.drawnSize, height: preview.drawnSize }} accessibilityLabel={preview.payload} />
    </View>
  </View>;
}
