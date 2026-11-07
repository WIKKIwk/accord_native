import { BottomSheet, type BottomSheetMethods } from '@expo/ui/community/bottom-sheet';
import { useRef, type ReactNode } from 'react';
import { View } from 'react-native';
import { useWorkerColors } from './useWorkerColors';
import { WorkerSheetCloseContext } from './workerSheetContext';

type Props = { children: ReactNode; onClose: () => void; dismissible?: boolean; compact?: boolean; fitContent?: boolean };

export function WorkerOrderSheet({ children, onClose, dismissible = false, compact = false }: Props) {
  const sheet = useRef<BottomSheetMethods>(null);
  const colors = useWorkerColors();
  return <BottomSheet ref={sheet} index={0} snapPoints={compact ? ['65%'] : ['86%']} enablePanDownToClose={dismissible}
    handleComponent={dismissible ? undefined : null} backgroundStyle={{ backgroundColor: colors.field }} onClose={onClose}>
    <View style={{ flex: 1 }}><WorkerSheetCloseContext.Provider value={() => sheet.current?.close()}>{children}</WorkerSheetCloseContext.Provider></View>
  </BottomSheet>;
}
