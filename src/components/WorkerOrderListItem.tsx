import { Pressable, StyleSheet, Text, useColorScheme, View } from 'react-native';
import type { Session } from '../auth';
import { orderCardAppearance, type OrderCardTone } from '../workerOrderAppearance';
import { useWorkerColors } from './useWorkerColors';
import { WorkerOrderThumbnail } from './WorkerOrderThumbnail';

type Props = { headline: string; supportingText: string; statusText?: string; statusDetail?: string; onPress: () => void; onLongPress?: () => void; session: Session; orderId: string; imageId: string; imageActive: boolean; cardTone?: OrderCardTone; first?: boolean; last?: boolean; fontFamily?: string; headlineFontFamily?: string };

export function WorkerOrderListItem({ headline, supportingText, onPress, onLongPress, session, orderId, imageId, imageActive, cardTone = 'neutral', fontFamily, headlineFontFamily }: Props) {
  const colors = useWorkerColors();
  const dark = useColorScheme() === 'dark';
  const appearance = orderCardAppearance(cardTone, dark ? '#101410' : colors.surface, dark);
  return <Pressable accessibilityRole="button" onPress={onPress} onLongPress={onLongPress} style={[styles.row, { backgroundColor: appearance.color, backgroundImage: appearance.gradient }]}>
    <WorkerOrderThumbnail session={session} orderId={orderId} imageId={imageId} active={imageActive} backgroundColor={colors.field} iconColor={colors.muted} />
    <View style={styles.text}><Text numberOfLines={1} style={{ color: appearance.text ?? (dark ? '#fff' : '#111'), fontFamily: headlineFontFamily, fontWeight: headlineFontFamily ? undefined : '500' }}>{headline}</Text>
      {!!supportingText && <Text numberOfLines={1} style={{ fontFamily, fontSize: 13, color: appearance.secondary ?? '#6b7280' }}>{supportingText}</Text>}</View>
  </Pressable>;
}

const styles = StyleSheet.create({ row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 16 }, text: { flex: 1, minWidth: 0, gap: 2 } });
