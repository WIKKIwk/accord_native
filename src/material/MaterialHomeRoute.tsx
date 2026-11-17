import { router, useFocusEffect, type Href } from 'expo-router';
import { useCallback, useState } from 'react';
import { Platform } from 'react-native';
import { isSessionWitnessCurrent } from '../auth';
import { RawSplitScanner } from '../homashyo/RawSplitScanner';
import { PreparationNotice } from '../preparation/PreparationNotice';
import { usePreparationNotice } from '../preparation/usePreparationNotice';
import { rawMaterialBarcodeFromQr } from '../shared/barcode/rawMaterialBarcode';
import { useMaterialContext } from './MaterialContext';
import { MaterialHome } from './MaterialHome';

/** Each focus owns its callbacks; a callback from a previous focus cannot revive. */
export function MaterialHomeRoute() {
  const { session, witness } = useMaterialContext();
  const [scanning, setScanning] = useState(false), notice = usePreparationNotice();
  const [lifetime, setLifetime] = useState<{ current: boolean; session: typeof session } | null>(null);
  useFocusEffect(useCallback(() => {
    const focus = { current: true, session };
    setLifetime(focus);
    return () => { focus.current = false; };
  }, [session]));
  const current = () => lifetime?.current === true && lifetime.session === session && isSessionWitnessCurrent(witness);
  const base = `/${Platform.OS === 'ios' ? 'ios' : 'android'}-material`;
  const navigate = (route: string) => { if (current()) router.push(`${base}/${route}` as Href); };
  return <><MaterialHome handlers={{ isCurrent: current,
    tasks: () => navigate('tasks'), receipt: () => navigate('receipt'), assignment: () => navigate('assignments'),
    movement: () => navigate('movements'), scan: () => { if (current()) setScanning(true); },
    showMissingGroup: () => { if (current()) notice.show('Avval material guruhlari biriktirilishi kerak'); } }} />
    <PreparationNotice message={notice.message} />
    <RawSplitScanner visible={scanning && current()} active={scanning && current()} isCurrent={current}
      onClose={() => setScanning(false)} onComplete={raw => {
        setScanning(false); const barcode = rawMaterialBarcodeFromQr(raw);
        if (!current() || !barcode) return false;
        router.push({ pathname: `${base}/assignments`, params: { barcode } } as Href); return true;
      }} />
  </>;
}
