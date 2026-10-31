import { useContext } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Session } from '../auth';
import { WorkerOrderPalette } from './workerOrderPalette';
import { WorkerOrderThumbnail } from './WorkerOrderThumbnail';

type Props = { headline: string; supportingText: string; onPress: () => void; session: Session; orderId: string; imageId: string; imageActive: boolean; first?: boolean; last?: boolean; fontFamily?: string; headlineFontFamily?: string };

export function WorkerOrderListItem({ headline, supportingText, onPress, session, orderId, imageId, imageActive, first = false, last = false, fontFamily, headlineFontFamily }: Props) {
  const colors = useContext(WorkerOrderPalette);
  if (!colors) throw new Error('WorkerOrderListItem requires WorkerOrderPalette');

  return <View style={[styles.inset, { paddingTop: first ? 0 : 1, paddingBottom: last ? 12 : 1 }]}>
    <Pressable accessibilityRole="button" onPress={onPress} android_ripple={{}} style={[styles.row, {
      backgroundColor: colors.surface,
      borderTopLeftRadius: first ? 16 : 4, borderTopRightRadius: first ? 16 : 4,
      borderBottomLeftRadius: last ? 16 : 4, borderBottomRightRadius: last ? 16 : 4,
    }]}>
      <WorkerOrderThumbnail session={session} orderId={orderId} imageId={imageId} active={imageActive} backgroundColor={colors.surfaceContainerHighest} iconColor={colors.onSurfaceVariant} />
      <View style={styles.text}>
        <Text numberOfLines={1} style={[styles.headline, { color: colors.onSurface, fontFamily: headlineFontFamily, fontWeight: headlineFontFamily ? undefined : '500' }]}>{headline}</Text>
        {supportingText ? <Text numberOfLines={1} style={[styles.supporting, { color: colors.onSurfaceVariant, fontFamily }]}>{supportingText}</Text> : null}
      </View>
    </Pressable>
  </View>;
}

const styles = StyleSheet.create({
  inset: { paddingHorizontal: 8 },
  row: { minHeight: 56, paddingHorizontal: 8, paddingVertical: 6, flexDirection: 'row', alignItems: 'center', overflow: 'hidden' },
  text: { flex: 1, marginStart: 16 },
  headline: { fontSize: 16, lineHeight: 24, includeFontPadding: false },
  supporting: { fontSize: 14, lineHeight: 20, includeFontPadding: false },
});
