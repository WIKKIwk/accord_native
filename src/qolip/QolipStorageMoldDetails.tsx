import * as Clipboard from 'expo-clipboard';
import { useContext, useMemo } from 'react';
import { ScrollView, Text } from 'react-native';
import { WorkerSheetButton } from '../components/WorkerSheetButton';
import { WorkerSheetCloseContext } from '../components/workerSheetContext';
import { useWorkerColors } from '../components/useWorkerColors';
import { extensionText } from '../shared/localization';
import { qolipProductFromJson } from '../qolipCatalogApi';
import { dartString } from './qolipApiCommon';
import type { QolipStorageMold } from './qolipStorageApi';
import { qolipStorageMoldStatus } from './qolipStoragePresentation';
import { useQolipText } from './useQolipText';
import { useQolipRole } from './QolipRoleContext';
import { useQolipPresentation } from './useQolipPresentation';
import { QolipMileageSheet } from './QolipMileageSheet';
import { QolipCatalogCodeDetails } from './QolipCatalogCodeDetails';

/** @v2 _moldDetails */
export function QolipStorageMoldDetails({ mold, archivedSnapshot = false }: { mold: QolipStorageMold; archivedSnapshot?: boolean }) {
  const role = useQolipRole(), { locale, text } = useQolipText(), colors = useWorkerColors(), mileage = useQolipPresentation();
  const close = useContext(WorkerSheetCloseContext), t = (key: string) => extensionText('qolipStorageText', key, locale);
  const product = useMemo(() => {
    const codes = mold.products.map(product => dartString(product.code).trim()).filter(Boolean);
    return qolipProductFromJson({ code: codes.length ? codes.join(', ') : mold.item_code, name: mold.product_names, item_group: '',
      qolip_code: mold.code, qolip_set_id: mold.set_id, warehouse: mold.warehouse, size: mold.size, color: mold.color });
  }, [mold]);
  const status = qolipStorageMoldStatus(mold);
  return <ScrollView><QolipCatalogCodeDetails product={product} close={close ?? undefined} loadMileage={!archivedSnapshot}
    canReprint={!archivedSnapshot && !mold.archived} copy={code => { if (role.isCurrent()) void Clipboard.setStringAsync(code); }}
    additionalDetails={[[t('set'), mold.set_id], [t('warehouse'), mold.warehouse], [text('products.color'), mold.color], [t('in_paddon'), mold.paddon_code]]
      .filter(([, value]) => !!value).map(([label, value]) => ({ label, value }))}
    afterDetails={<>{!archivedSnapshot && (!mold.paddon_code || mold.archived) && <Text style={{ color: colors.text }}>{t(status.key)}{status.code ? `: ${status.code}` : ''}</Text>}
      <WorkerSheetButton label={t('mileage')} variant="text" onPress={() => mileage.open(<QolipMileageSheet session={role.session} code={mold.code} />,
        { dismissible: true, heightFraction: 0.65 })} /></>} />
  </ScrollView>;
}
