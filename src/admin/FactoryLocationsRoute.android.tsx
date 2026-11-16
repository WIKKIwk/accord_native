import { AlertDialog, Host, RNHostView, SnackbarHost, Text as ComposeText, useMaterialColors, type SnackbarHostRef } from '@expo/ui/jetpack-compose';
import { useEffect, useRef, useSyncExternalStore } from 'react';
import { ScrollView, View, useWindowDimensions } from 'react-native';
import { localeController } from '../shared/localization/runtime';
import { factoryLocationEditorText } from './factoryLocationEditorText';
import { factoryLocationRenameText } from './factoryLocationRenameText';
import { factoryLocationDialogProps } from './factoryLocationDialogProps';
import { FactoryLocationEditorContent } from './FactoryLocationEditorContent';
import { FactoryLocationRenameContent } from './FactoryLocationRenameContent';
import { FactoryLocationPickerSheet } from './FactoryLocationPickerSheet.android';
import { FactoryLocationScreen } from './FactoryLocationScreen.android';
import { useFactoryLocationsRoute, type FactoryLocationsRouteProps } from './useFactoryLocationsRoute';

const subscribe = (listener: () => void) => localeController.addListener(listener), locale = () => localeController.locale;
/** @v2 AdminFactoryLocationsScreen: real dialog, picker and captured-session composition. */
export function FactoryLocationsRoute(props: FactoryLocationsRouteProps) {
  const model = useFactoryLocationsRoute(props), language = useSyncExternalStore(subscribe, locale, locale), colors = useMaterialColors();
  const { dialog, picker, invalidName } = model.presentation, { presentation } = model.owner;
  const snackbar = useRef<SnackbarHostRef>(null), { height } = useWindowDimensions();
  useEffect(() => { if (dialog?.closing) presentation.dismissed(dialog); }, [dialog, presentation]);
  useEffect(() => { if (invalidName) void snackbar.current?.showSnackbar({ message: invalidName, duration: 'short' }); }, [invalidName]);
  const editor = dialog ? factoryLocationDialogProps(dialog, presentation, model.apparatus) : null;
  const title = dialog?.kind === 'editor' ? factoryLocationEditorText(language, dialog.ticket.location).title : factoryLocationRenameText(language).title;
  return <View style={{ flex: 1 }}><FactoryLocationScreen {...model.screen} />
    {dialog && !dialog.closing && editor ? <Host style={{ position: 'absolute', width: '100%' }}>
      <AlertDialog onDismissRequest={() => { if (!picker) presentation.cancel(dialog); }}
        colors={{ containerColor: colors.surfaceContainerHigh }} properties={{ dismissOnBackPress: !picker, dismissOnClickOutside: !picker }}>
        <AlertDialog.Title><ComposeText>{title}</ComposeText></AlertDialog.Title>
        <AlertDialog.Text><RNHostView matchContents><ScrollView keyboardShouldPersistTaps="handled" style={{ maxHeight: height * 0.65 }} contentContainerStyle={{ paddingTop: 16 }}>
            {dialog.kind === 'editor' ? <FactoryLocationEditorContent {...editor} /> : <FactoryLocationRenameContent {...editor} />}
          </ScrollView></RNHostView></AlertDialog.Text>
      </AlertDialog>
    </Host> : null}
    {picker ? <FactoryLocationPickerSheet key={picker.id} apparatus={model.apparatus} initialSelected={picker.selected}
      onConfirm={selected => presentation.finishPicker(picker, selected)} onCancel={() => presentation.finishPicker(picker, null)} /> : null}
    <Host matchContents style={{ position: 'absolute', bottom: 16, left: 16, right: 16 }}><SnackbarHost ref={snackbar} /></Host>
  </View>;
}
