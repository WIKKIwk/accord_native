import { Button, Column, Host, ListItem } from '@expo/ui';
import { Image } from 'expo-image';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { WorkerIconButton } from './WorkerIconButton';
import { WorkerOrderThumbnail } from './WorkerOrderThumbnail';
import { useWorkerColors } from './useWorkerColors';
import type { WorkerWipBatchDetailsViewProps } from './workerWipBatchDetailsTypes';

export function WorkerWipBatchDetailsView(props: WorkerWipBatchDetailsViewProps) {
  const colors = useWorkerColors();
  return <View style={styles.fill}>
    <View style={styles.header}>
      <Text style={[styles.title, styles.fill, { color: colors.text }]}>{props.title}</Text>
      <View style={{ flexDirection: 'row', gap: 8 }} pointerEvents={props.busy ? 'none' : 'auto'} accessibilityState={{ disabled: props.busy }}>
        {props.onEdit ? <WorkerIconButton icon="edit" label={props.editLabel} onPress={props.onEdit} /> : null}
        <WorkerIconButton icon="close" label={props.closeLabel} onPress={props.onClose} tonal />
      </View>
    </View>
    <ScrollView nestedScrollEnabled keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <WorkerOrderThumbnail session={props.session} orderId={props.order.id} imageId={props.order.imageId} active
          backgroundColor={colors.surface} iconColor={colors.icon} />
        <Text style={[styles.title, styles.fill, { color: colors.text }]}>{props.itemName}</Text>
      </View>
      {props.qrImage ? <Image source={{ uri: props.qrImage }} style={styles.qr} contentFit="contain" cachePolicy="none" accessibilityLabel="WIP QR kodi" /> :
        <Text selectable style={{ color: colors.text }}>{props.payload}</Text>}
      <Host matchContents={{ vertical: true }} style={styles.host}>
        <Column>{props.rows.map(([label, value]) => <ListItem key={label} supportingText={value}>{label}</ListItem>)}</Column>
      </Host>
      {props.canReprint ? <Host matchContents={{ vertical: true }} style={styles.host}>
        <Column spacing={8}><Button label={props.reprintLabel} disabled={props.busy} onPress={props.onReprint} /></Column>
      </Host> : null}
      {!!props.message && <Text accessibilityRole="alert" style={{ color: colors.error }}>{props.message}</Text>}
    </ScrollView>
  </View>;
}

const styles = StyleSheet.create({
  fill: { flex: 1 }, header: { paddingHorizontal: 14, paddingTop: 10, flexDirection: 'row', alignItems: 'center', gap: 10 },
  title: { fontSize: 20, fontWeight: '700' }, content: { padding: 12, gap: 12, paddingBottom: 28 },
  qr: { width: 208, height: 208, alignSelf: 'center', backgroundColor: '#fff' }, host: { width: '100%' },
});
