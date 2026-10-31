import { BottomSheet, type BottomSheetMethods } from '@expo/ui/community/bottom-sheet';
import { useCallback, useRef, type ReactNode } from 'react';
import { ScrollView, View } from 'react-native';
import { WorkerSheetCloseContext } from './workerSheetContext';

type Props = { children: ReactNode; onClose: () => void; dismissible?: boolean; compact?: boolean };

export function WorkerOrderSheet({ children, onClose, dismissible = false, compact = false }: Props) {
  const sheet = useRef<BottomSheetMethods>(null);
  const close = useCallback(() => sheet.current?.close(), []);

  return <BottomSheet ref={sheet} index={0} snapPoints={compact ? ['50%', '90%'] : ['90%']}
    enablePanDownToClose={dismissible} handleComponent={dismissible ? undefined : null} onClose={onClose}>
    <WorkerSheetCloseContext.Provider value={close}>
      {compact ? <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingTop: 8, paddingBottom: 24 }}>
        {children}
      </ScrollView> : <View style={{ flex: 1 }}>{children}</View>}
    </WorkerSheetCloseContext.Provider>
  </BottomSheet>;
}
