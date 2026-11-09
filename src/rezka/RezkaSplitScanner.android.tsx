import { useMaterialColors } from '@expo/ui/jetpack-compose';
import { Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { RoleHeader } from '../shared/navigation/RoleHeader.android';
import { RezkaScannerPreview, type RezkaSplitScannerProps } from './RezkaScannerPreview';
import { useRezkaText } from './useRezkaSplit';

// @v2 _RezkaScannerDialog
export function RezkaSplitScanner({ close, ...camera }: RezkaSplitScannerProps) {
  const t = useRezkaText(), colors = useMaterialColors();
  return <Modal visible animationType="fade" presentationStyle="fullScreen" onRequestClose={close}>
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <RoleHeader title={t('QR scan')} navigation={{ icon: 'back', label: t('Orqaga'), onPress: close }} />
      <RezkaScannerPreview {...camera} />
    </SafeAreaView>
  </Modal>;
}
