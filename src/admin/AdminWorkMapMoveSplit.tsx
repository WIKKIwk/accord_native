import { useMemo, useSyncExternalStore, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { useBaseTheme } from '../components/useBaseTheme';
import { AdminWorkMapMoveSplit as Split } from './adminWorkMapMoveSplitState';

/** Local divider movement only. Order dragging and transfer remain disconnected. */
export function AdminWorkMapMoveSplit({ topHeader, topBody, bottomHeader, bottomBody }: {
  topHeader: ReactNode; topBody: ReactNode; bottomHeader: ReactNode; bottomBody: ReactNode;
}) {
  const { colors, direction } = useBaseTheme(), split = useMemo(() => new Split(), []);
  useSyncExternalStore(split.subscribe, split.getSnapshot, split.getSnapshot);
  const flex = split.flex();
  return <View style={[styles.padding, { direction: direction === 'rightToLeft' ? 'rtl' : 'ltr' }]}><View style={styles.layout} onLayout={event => split.setHeight(event.nativeEvent.layout.height)}>
    <View style={{ flex: flex.top }}><View style={styles.topHeader}>{topHeader}</View><View style={styles.topGap} /><View style={styles.body}>{topBody}</View></View>
    <View testID="admin-move-divider" style={styles.divider} onTouchStart={event => split.start(event.nativeEvent.changedTouches)}
      onTouchMove={event => split.move(event.nativeEvent.changedTouches)} onTouchEnd={event => split.end(event.nativeEvent.changedTouches)} onTouchCancel={event => split.end(event.nativeEvent.changedTouches)}>
      <View style={[styles.line, { backgroundColor: colors.outlineVariant }]} /><View style={styles.bottomHeader}>{bottomHeader}</View>
      <View style={[styles.line, { backgroundColor: colors.outlineVariant }]} />
    </View>
    <View style={{ flex: flex.bottom }}>{bottomBody}</View>
  </View></View>;
}
const styles = StyleSheet.create({ padding: { flex: 1, paddingHorizontal: 4, paddingTop: 8, paddingBottom: 4 }, layout: { flex: 1 },
  topHeader: { alignItems: 'center' }, topGap: { height: 8 }, body: { flex: 1 },
  divider: { paddingVertical: 8, flexDirection: 'row', alignItems: 'center' }, line: { height: 1, flex: 1 }, bottomHeader: { maxWidth: '33.333%', flexShrink: 1 } });
