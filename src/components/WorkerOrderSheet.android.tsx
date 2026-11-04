import { Host, ModalBottomSheet, RNHostView } from '@expo/ui/jetpack-compose';
import type { ReactNode } from 'react';
import { ScrollView, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useWorkerColors } from './useWorkerColors';
import { WorkerSheetCloseContext } from './workerSheetContext';

type Props = { children: ReactNode; onClose: () => void; dismissible?: boolean; compact?: boolean };

export function WorkerOrderSheet({ children, onClose, dismissible = false, compact = false }: Props) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const colors = useWorkerColors();
  const sheetHeight = Math.round((height - insets.top) * (compact ? 0.65 : 0.86));

  return <Host style={{ position: 'absolute', top: 0, bottom: 0, width }} pointerEvents="none">
    <ModalBottomSheet onDismissRequest={onClose} skipPartiallyExpanded
      sheetGesturesEnabled={dismissible} showDragHandle={dismissible} containerColor={colors.field}
      properties={{ shouldDismissOnBackPress: true, shouldDismissOnClickOutside: dismissible }}>
      <RNHostView matchContents>
        <View style={{ width, height: sheetHeight, paddingBottom: insets.bottom }}>
          <WorkerSheetCloseContext.Provider value={onClose}>
            {compact ? <ScrollView nestedScrollEnabled keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingTop: 8 }}>
              {children}
            </ScrollView> : children}
          </WorkerSheetCloseContext.Provider>
        </View>
      </RNHostView>
    </ModalBottomSheet>
  </Host>;
}
