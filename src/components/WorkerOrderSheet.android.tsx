import { Host, ModalBottomSheet, RNHostView, type ModalBottomSheetRef } from '@expo/ui/jetpack-compose';
import { useRef, type ReactNode } from 'react';
import { useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useWorkerColors } from './useWorkerColors';
import { WorkerSheetCloseContext } from './workerSheetContext';

type Props = { children: ReactNode; onClose: () => void; dismissible?: boolean; compact?: boolean };

export function WorkerOrderSheet({ children, onClose, dismissible = false, compact = false }: Props) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const colors = useWorkerColors();
  const sheet = useRef<ModalBottomSheetRef>(null);
  const closing = useRef(false);
  const close = () => {
    if (closing.current) return;
    closing.current = true;
    const hiding = sheet.current?.hide();
    if (hiding) void hiding.then(onClose, onClose);
    else onClose();
  };

  return <Host style={{ position: 'absolute', top: 0, bottom: 0, width }} pointerEvents="none">
    <ModalBottomSheet ref={sheet} onDismissRequest={onClose} skipPartiallyExpanded
      sheetGesturesEnabled={dismissible} showDragHandle={dismissible} containerColor={colors.field}
      properties={{ shouldDismissOnBackPress: true, shouldDismissOnClickOutside: dismissible }}>
      <RNHostView matchContents>
        <View style={{ width, ...(compact ? {} : { height: Math.round((height - insets.top) * 0.86) }) }}>
          <WorkerSheetCloseContext.Provider value={close}>{children}</WorkerSheetCloseContext.Provider>
        </View>
      </RNHostView>
    </ModalBottomSheet>
  </Host>;
}
