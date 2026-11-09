import { Button, Host, NavigationStack, RNHostView, Toolbar, ToolbarItem } from '@expo/ui/swift-ui';
import { accessibilityLabel, labelStyle, navigationBarTitleDisplayMode, navigationTitle } from '@expo/ui/swift-ui/modifiers';
import { Modal } from 'react-native';
import { RezkaScannerPreview, type RezkaSplitScannerProps } from './RezkaScannerPreview';
import { useRezkaText } from './useRezkaSplit';

// @v2 _RezkaScannerDialog
export function RezkaSplitScanner({ close, ...camera }: RezkaSplitScannerProps) {
  const t = useRezkaText();
  return <Modal visible animationType="fade" presentationStyle="fullScreen" onRequestClose={close}>
    <Host style={{ flex: 1 }}>
      {/* This stack supplies native dialog chrome only. App navigation remains with Expo Router. */}
      <NavigationStack><Toolbar modifiers={[navigationTitle(t('QR scan')), navigationBarTitleDisplayMode('inline')]}>
        <RNHostView><RezkaScannerPreview {...camera} /></RNHostView>
        <Toolbar.Content><ToolbarItem placement="topBarLeading">
          <Button label={t('Orqaga')} systemImage="chevron.left" modifiers={[labelStyle('iconOnly'), accessibilityLabel(t('Orqaga'))]} onPress={close} />
        </ToolbarItem></Toolbar.Content>
      </Toolbar></NavigationStack>
    </Host>
  </Modal>;
}
