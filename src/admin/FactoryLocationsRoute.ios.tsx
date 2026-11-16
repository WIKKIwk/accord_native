import { Host, Text as SwiftText } from '@expo/ui/swift-ui';
import { font } from '@expo/ui/swift-ui/modifiers';
import { useSyncExternalStore } from 'react';
import { KeyboardAvoidingView, Modal, PlatformColor, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { localeController } from '../shared/localization/runtime';
import { factoryLocationEditorText } from './factoryLocationEditorText';
import { factoryLocationRenameText } from './factoryLocationRenameText';
import { factoryLocationDialogProps } from './factoryLocationDialogProps';
import { FactoryLocationEditorContent } from './FactoryLocationEditorContent';
import { FactoryLocationRenameContent } from './FactoryLocationRenameContent';
import { FactoryLocationPickerSheet } from './FactoryLocationPickerSheet.ios';
import { FactoryLocationScreen } from './FactoryLocationScreen.ios';
import { useFactoryLocationsRoute, type FactoryLocationsRouteProps } from './useFactoryLocationsRoute';

const subscribe = (listener: () => void) => localeController.addListener(listener), locale = () => localeController.locale;
/** @v2 AdminFactoryLocationsScreen: native controls in a dialog and an independent picker sheet. */
export function FactoryLocationsRoute(props: FactoryLocationsRouteProps) {
  const model = useFactoryLocationsRoute(props), language = useSyncExternalStore(subscribe, locale, locale), { height } = useWindowDimensions();
  const { dialog, picker, invalidName } = model.presentation, { presentation } = model.owner;
  const editor = dialog ? factoryLocationDialogProps(dialog, presentation, model.apparatus) : null;
  const title = dialog?.kind === 'editor' ? factoryLocationEditorText(language, dialog.ticket.location).title : factoryLocationRenameText(language).title;
  return <View style={{ flex: 1 }}><FactoryLocationScreen {...model.screen} />
    {dialog && editor ? <Modal visible={!dialog.closing} transparent animationType="fade"
      onRequestClose={() => { if (!picker) presentation.cancel(dialog); }} onDismiss={() => presentation.dismissed(dialog)}>
      <KeyboardAvoidingView behavior="padding" style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={() => { if (!picker) presentation.cancel(dialog); }} />
        <View accessibilityViewIsModal style={styles.dialog}>
          <Host matchContents={{ vertical: true }}><SwiftText modifiers={[font({ textStyle: 'title3', weight: 'semibold' })]}>{title}</SwiftText></Host>
          <ScrollView keyboardShouldPersistTaps="handled" style={{ maxHeight: height * 0.65 }} contentContainerStyle={{ paddingTop: 16 }}>
            {dialog.kind === 'editor' ? <FactoryLocationEditorContent {...editor} /> : <FactoryLocationRenameContent {...editor} />}
          </ScrollView>
        </View>
        {picker ? <FactoryLocationPickerSheet key={picker.id} apparatus={model.apparatus} initialSelected={picker.selected}
          onConfirm={selected => presentation.finishPicker(picker, selected)} onCancel={() => presentation.finishPicker(picker, null)} /> : null}
        {invalidName ? <View pointerEvents="none" accessibilityRole="alert" style={styles.notice}><Text style={{ color: PlatformColor('label') }}>{invalidName}</Text></View> : null}
      </KeyboardAvoidingView>
    </Modal> : null}
  </View>;
}
const styles = StyleSheet.create({ backdrop: { flex: 1, justifyContent: 'center', paddingHorizontal: 20, backgroundColor: 'rgba(0,0,0,0.35)' },
  dialog: { width: '100%', maxWidth: 480, alignSelf: 'center', borderRadius: 24, padding: 24, backgroundColor: PlatformColor('secondarySystemGroupedBackground') },
  notice: { position: 'absolute', left: 16, right: 16, bottom: 16, borderRadius: 12, padding: 12, backgroundColor: PlatformColor('secondarySystemBackground') } });
