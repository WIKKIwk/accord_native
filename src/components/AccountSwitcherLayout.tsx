import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View, type ViewStyle } from 'react-native';

export function AccountSwitcherLayout({ padding, header, children, footer }: {
  padding: ViewStyle; header?: ReactNode; children: ReactNode; footer?: ReactNode;
}) {
  return <View style={[styles.content, padding]}>
    {header}
    <ScrollView nestedScrollEnabled keyboardShouldPersistTaps="handled" style={styles.list}>
      {children}
    </ScrollView>
    {footer}
  </View>;
}

const styles = StyleSheet.create({
  content: { width: '100%', flexShrink: 1, gap: 16 },
  list: { flexGrow: 0, flexShrink: 1 },
});
