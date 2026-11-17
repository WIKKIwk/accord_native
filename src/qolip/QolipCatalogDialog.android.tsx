import { AlertDialog, Host, RNHostView } from '@expo/ui/jetpack-compose';
import type { ReactNode } from 'react';
import { ScrollView, useWindowDimensions, View } from 'react-native';
// @v2 _MoldAddDialog
export function QolipCatalogDialog({ children, close, preventDismiss = false, dismissOnOutside = true }: { children: ReactNode; close(): void; preventDismiss?: boolean; dismissOnOutside?: boolean }) {
  const { width, height } = useWindowDimensions();
  return <Host style={{ position: 'absolute', top: 0, width, height }} pointerEvents="none"><AlertDialog properties={{ dismissOnClickOutside: dismissOnOutside && !preventDismiss, dismissOnBackPress: !preventDismiss }} onDismissRequest={() => { if (!preventDismiss) close(); }}>
    <AlertDialog.Text><RNHostView matchContents><View style={{ width: Math.min(width - 72, 420), maxHeight: height * 0.8 }}><ScrollView keyboardShouldPersistTaps="handled">{children}</ScrollView></View></RNHostView></AlertDialog.Text>
  </AlertDialog></Host>;
}
