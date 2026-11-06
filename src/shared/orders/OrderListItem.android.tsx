import { useContext } from 'react';
import { StyleSheet, Text, useColorScheme, View } from 'react-native';
import type { Session } from '../../auth';
import { orderCardAppearance, type OrderCardTone } from '../../workerOrderAppearance';
import { WorkerOrderPalette } from '../../components/workerOrderPalette';
import { WorkerOrderThumbnail } from '../../components/WorkerOrderThumbnail';
import { WorkerQueueCard } from '../../components/WorkerQueueCard.android';

type Props = { headline: string; supportingText: string; statusText?: string; statusDetail?: string; onPress: () => void; onLongPress?: () => void; session: Session; orderId: string; imageId: string; imageActive: boolean; cardTone?: OrderCardTone; first?: boolean; last?: boolean; fontFamily?: string; headlineFontFamily?: string };

export function OrderListItem({ headline, supportingText, onPress, onLongPress, session, orderId, imageId, imageActive, cardTone = 'neutral', first = false, last = false, fontFamily, headlineFontFamily }: Props) {
  const colors = useContext(WorkerOrderPalette);
  const dark = useColorScheme() === 'dark';
  if (!colors) throw new Error('WorkerOrderListItem requires WorkerOrderPalette');
  const appearance = orderCardAppearance(cardTone, colors.surfaceContainerLowest, dark);

  return <WorkerQueueCard backgroundColor={appearance.color ?? colors.surface} backgroundImage={appearance.gradient} first={first} last={last} onPress={onPress} onLongPress={onLongPress}>
      <WorkerOrderThumbnail session={session} orderId={orderId} imageId={imageId} active={imageActive} backgroundColor={colors.surfaceContainerHighest} iconColor={colors.onSurfaceVariant} />
      <View style={styles.text}>
        <Text numberOfLines={1} style={[styles.headline, { color: appearance.text ?? colors.onSurface, fontFamily: headlineFontFamily, fontWeight: headlineFontFamily ? undefined : '500' }]}>{headline}</Text>
        {supportingText ? <Text numberOfLines={1} style={[styles.supporting, { color: appearance.secondary ?? colors.onSurfaceVariant, fontFamily }]}>{supportingText}</Text> : null}
      </View>
  </WorkerQueueCard>;
}

const styles = StyleSheet.create({
  text: { flex: 1, marginStart: 16 },
  headline: { fontSize: 16, lineHeight: 24, includeFontPadding: false },
  supporting: { fontSize: 14, lineHeight: 20, includeFontPadding: false },
});
