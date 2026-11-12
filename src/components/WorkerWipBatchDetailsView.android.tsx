import { Button, Host, RNHostView, Row, Text as NativeText, useMaterialColors } from '@expo/ui/jetpack-compose';
import { fillMaxWidth, height, testID } from '@expo/ui/jetpack-compose/modifiers';
import { Image } from 'expo-image';
import { SymbolView } from 'expo-symbols';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { WorkerIconButton } from './WorkerIconButton';
import { WorkerOrderThumbnail } from './WorkerOrderThumbnail';
import { useWorkerColors } from './useWorkerColors';
import type { WorkerWipBatchDetailsViewProps } from './workerWipBatchDetailsTypes';

/** @v2 WorkerWipDetailsSheet */
export function WorkerWipBatchDetailsView(props: WorkerWipBatchDetailsViewProps) {
  const colors = useWorkerColors(), material = useMaterialColors({});
  return <View style={styles.fill}>
    <View style={styles.header}>
      <Text style={[styles.title, styles.fill, { color: colors.text }]}>{props.title}</Text>
      <View style={styles.headerActions} pointerEvents={props.busy ? 'none' : 'auto'} accessibilityState={{ disabled: props.busy }}>
        {props.onEdit ? <WorkerIconButton icon="edit" label={props.editLabel} onPress={props.onEdit} /> : null}
        <WorkerIconButton icon="close" label={props.closeLabel} onPress={props.onClose} tonal />
      </View>
    </View>
    <ScrollView nestedScrollEnabled keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
      {props.qrImage ? <View style={styles.qrFrame}>
        <Image source={{ uri: props.qrImage }} style={styles.qr} contentFit="contain" cachePolicy="none" accessibilityLabel="WIP QR kodi" />
      </View> : <Text selectable style={[styles.payload, { color: colors.text }]}>{props.payload}</Text>}
      <View style={styles.identity}>
        <WorkerOrderThumbnail session={props.session} orderId={props.order.id} imageId={props.order.imageId} active
          backgroundColor={colors.surface} iconColor={colors.icon} />
        <Text style={[styles.itemName, styles.fill, { color: colors.text }]}>{props.itemName}</Text>
      </View>
      <View style={styles.details}>
        {props.rows.map(([label, value]) => <View key={label} style={styles.detailRow}>
          <Text style={[styles.label, { color: colors.muted }]}>{label}</Text>
          <Text style={[styles.value, { color: colors.text }]}>{value}</Text>
        </View>)}
      </View>
      {props.canReprint ? <Host matchContents={{ vertical: true }} style={styles.host}>
        <Button enabled={!props.busy} onClick={props.onReprint} modifiers={[fillMaxWidth(), height(52), testID('worker-wip-qr-reprint')]}>
          <Row verticalAlignment="center" horizontalArrangement={{ spacedBy: 8 }}>
            <RNHostView matchContents><SymbolView name={{ android: 'print' }} size={20} tintColor={props.busy ? material.onSurfaceVariant : material.onPrimary} /></RNHostView>
            <NativeText>{props.reprintLabel}</NativeText>
          </Row>
        </Button>
      </Host> : null}
      {!!props.message && <Text accessibilityRole="alert" style={[styles.error, { color: colors.error }]}>{props.message}</Text>}
    </ScrollView>
  </View>;
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  header: { paddingHorizontal: 16, paddingTop: 10, flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerActions: { flexDirection: 'row', gap: 8 },
  title: { fontSize: 20, fontWeight: '700' },
  content: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 24, gap: 16 },
  qrFrame: { width: 240, maxWidth: '100%', aspectRatio: 1, padding: 16, borderRadius: 18, backgroundColor: '#fff', alignSelf: 'center', overflow: 'hidden' },
  qr: { width: '100%', height: '100%' },
  payload: { textAlign: 'center' },
  identity: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  itemName: { fontSize: 16, lineHeight: 22, fontWeight: '700' },
  details: { gap: 6 },
  detailRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  label: { width: 112, fontSize: 13, lineHeight: 20 },
  value: { flex: 1, fontSize: 14, lineHeight: 20 },
  host: { width: '100%' },
  error: { textAlign: 'center', fontWeight: '600' },
});
