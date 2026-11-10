import { Host, ModalBottomSheet, RNHostView, type ModalBottomSheetRef } from '@expo/ui/jetpack-compose';
import type { ReactNode, Ref } from 'react';
import { ScrollView, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useWorkerColors } from './useWorkerColors';
import { WorkerSheetCloseContext } from './workerSheetContext';

type Props = { children: ReactNode; onClose: () => void; dismissible?: boolean; preventDismiss?: boolean; compact?: boolean; fitContent?: boolean; heightFraction?: number;
  sheetRef?: Ref<ModalBottomSheetRef> };

export function WorkerOrderSheet({ children, onClose, dismissible = false, preventDismiss = false, compact = false, fitContent = false, heightFraction, sheetRef }: Props) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const colors = useWorkerColors();
  const sheetHeight = Math.round((height - insets.top) * (heightFraction ?? (compact ? 0.65 : 0.86)));

  return <Host style={{ position: 'absolute', top: 0, bottom: 0, width }} pointerEvents="none">
    <ModalBottomSheet ref={sheetRef} onDismissRequest={() => { if (!preventDismiss) onClose(); }} skipPartiallyExpanded
      sheetGesturesEnabled={dismissible && !preventDismiss} showDragHandle={dismissible} containerColor={colors.field}
      properties={{ shouldDismissOnBackPress: !preventDismiss, shouldDismissOnClickOutside: dismissible && !preventDismiss }}>
      <RNHostView matchContents>
        <View style={{ width, ...(fitContent ? { maxHeight: sheetHeight } : { height: sheetHeight }), paddingBottom: insets.bottom }}>
          <WorkerSheetCloseContext.Provider value={onClose}>
            {compact ? <ScrollView nestedScrollEnabled keyboardShouldPersistTaps="handled" style={fitContent ? { flexGrow: 0, flexShrink: 1 } : undefined} contentContainerStyle={{ paddingTop: 8 }}>
              {children}
            </ScrollView> : children}
          </WorkerSheetCloseContext.Provider>
        </View>
      </RNHostView>
    </ModalBottomSheet>
  </Host>;
}
