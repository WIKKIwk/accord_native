import { BottomSheet, Group, Host, RNHostView } from '@expo/ui/swift-ui';
import { interactiveDismissDisabled, presentationBackground, presentationDetents, presentationDragIndicator, presentationSizing, type PresentationDetent } from '@expo/ui/swift-ui/modifiers';
import { useCallback, useRef, useState, type Context, type ReactNode } from 'react';
import { PlatformColor, ScrollView, useWindowDimensions, View, VirtualizedList } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WorkerSheetCloseContext } from './workerSheetContext';
import { useBaseTheme } from './useBaseTheme';

type Props = { children: ReactNode; onClose: () => void; dismissible?: boolean; preventDismiss?: boolean; compact?: boolean; fitContent?: boolean; heightFraction?: number };
const scrollContext = (ScrollView as unknown as { Context?: Context<unknown> }).Context;
const listContext = (VirtualizedList as unknown as { contextType?: Context<unknown> }).contextType;

export function WorkerOrderSheet({ children, onClose, dismissible = false, preventDismiss = false, compact = false, fitContent = false, heightFraction }: Props) {
  const fraction = heightFraction ?? (compact ? 0.5 : 0.9);
  const [presented, setPresented] = useState(true);
  const [detent, setDetent] = useState<PresentationDetent>({ fraction });
  const closed = useRef(false), theme = useBaseTheme();
  const close = useCallback(() => setPresented(false), []);
  const { height, width } = useWindowDimensions(), insets = useSafeAreaInsets();
  const maxHeight = Math.round((height - insets.top - insets.bottom) * (heightFraction ?? (compact ? 0.65 : 0.86)));
  const backgroundColor = PlatformColor('systemGroupedBackground');
  const dismiss = () => { if (!closed.current) { closed.current = true; onClose(); } };

  let content: ReactNode = <WorkerSheetCloseContext.Provider value={close}>
      {compact ? <ScrollView keyboardShouldPersistTaps="handled"
        contentInsetAdjustmentBehavior="automatic"
        style={fitContent ? { flexGrow: 0, maxHeight } : { flex: 1 }}
        contentContainerStyle={fitContent ? undefined : { paddingTop: 8, paddingBottom: 24 }}>
        {children}
      </ScrollView> : <View style={fitContent ? { maxHeight } : { flex: 1 }}>{children}</View>}
    </WorkerSheetCloseContext.Provider>;
  // Presented RN content owns a new scroll tree, even when its launcher is inside a list.
  if (scrollContext) content = <scrollContext.Provider value={null}>{content}</scrollContext.Provider>;
  if (listContext) content = <listContext.Provider value={null}>{content}</listContext.Provider>;

  return <Host style={{ position: 'absolute', width }} pointerEvents="none" colorScheme={theme.mode}
    seedColor={theme.colors.primary ?? theme.seed} layoutDirection={theme.direction}>
    <BottomSheet isPresented={presented} onIsPresentedChange={setPresented} onDismiss={dismiss} fitToContents={fitContent}>
      <Group modifiers={[
        presentationBackground(backgroundColor), presentationDragIndicator(dismissible ? 'visible' : 'hidden'), interactiveDismissDisabled(preventDismiss || !dismissible),
        ...(fitContent ? [presentationSizing('automatic', { fitted: { horizontal: false, vertical: true } })]
          : [presentationDetents(compact && heightFraction == null ? [{ fraction: 0.5 }, { fraction: 0.9 }] : [{ fraction }], { selection: detent, onSelectionChange: setDetent })]),
      ]}>
        <RNHostView matchContents={fitContent ? { vertical: true } : false}>
          <View style={{ ...(fitContent ? {} : { flexGrow: 1, height: 0 }), paddingTop: dismissible ? 16 : 0, backgroundColor }}>
            {content}
          </View>
        </RNHostView>
      </Group>
    </BottomSheet>
  </Host>;
}
