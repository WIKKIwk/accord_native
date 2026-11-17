import { Host, ModalBottomSheet, RNHostView } from '@expo/ui/jetpack-compose';
import type { ReactNode } from 'react';
import { ScrollView, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useWorkerColors } from '../components/useWorkerColors';

// @v2 _QolipAttachSheet
export function QolipCatalogSpecSheet({ children, standalone, saving, close }: { children: ReactNode; standalone: boolean; saving: boolean; close(): void }) {
  const { width, height } = useWindowDimensions(), insets = useSafeAreaInsets(), colors = useWorkerColors(), block = standalone && saving;
  return <Host style={{ position: 'absolute', top: 0, bottom: 0, width }} pointerEvents="none"><ModalBottomSheet
    onDismissRequest={() => { if (!block) close(); }} skipPartiallyExpanded sheetGesturesEnabled={!standalone} showDragHandle
    containerColor={colors.surface} properties={{ shouldDismissOnBackPress: !block, shouldDismissOnClickOutside: !block }}>
    <RNHostView matchContents><View style={{ width, maxHeight: (height - insets.top) * 0.92, paddingBottom: insets.bottom }}>
      <ScrollView keyboardShouldPersistTaps="handled">{children}</ScrollView>
    </View></RNHostView>
  </ModalBottomSheet></Host>;
}
