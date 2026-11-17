import { Column, Host, IconButton, RNHostView, Row, Text, useMaterialColors } from '@expo/ui/jetpack-compose';
import { semantics, weight } from '@expo/ui/jetpack-compose/modifiers';
import { SymbolView } from 'expo-symbols';
import { View } from 'react-native';
import { WorkerQueueCard } from '../components/WorkerQueueCard.android';
import type { QolipTransferControlsProps, QolipTransferRowProps } from './qolipProductTransferNativeTypes';
export function QolipProductTransferControls(props: QolipTransferControlsProps) {
  const colors = useMaterialColors();
  return <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}><Host style={{ flex: 1 }} matchContents={{ vertical: true }}><Text style={{ typography: 'bodySmall' }}>{props.hint}</Text></Host>
    <Host matchContents><Row><IconButton enabled={!props.disabled} onClick={props.scan} modifiers={[semantics({ contentDescription: props.scanLabel })]}><RNHostView matchContents><SymbolView name={{ android: 'qr_code_scanner' }} size={24} tintColor={colors.onSurfaceVariant} /></RNHostView></IconButton>
      <IconButton enabled={!props.disabled} onClick={props.refresh} modifiers={[semantics({ contentDescription: props.refreshLabel })]}><RNHostView matchContents><SymbolView name={{ android: 'refresh' }} size={24} tintColor={colors.onSurfaceVariant} /></RNHostView></IconButton></Row></Host></View>;
}
export function QolipProductTransferRow(props: QolipTransferRowProps) {
  const colors = useMaterialColors();
  return <WorkerQueueCard first={props.first} last={props.last} backgroundColor={props.disabled ? colors.surfaceContainerHighest : colors.surfaceContainerHigh}
    disabled={props.disabled} onPress={props.onToggle} style={{ opacity: props.disabled ? 0.48 : 1 }}>
    <Host matchContents style={{ width: 34 }}><Text color={props.selected ? colors.primary : colors.onSurfaceVariant} style={{ fontSize: 16, fontWeight: '800' }}>{props.selected ? '✓' : String(props.index + 1)}</Text></Host>
    <Host style={{ flex: 1 }} matchContents={{ vertical: true }}><Column verticalArrangement={{ spacedBy: 4 }}>
      <Row><Text style={{ typography: 'labelMedium', fontWeight: '800' }}>{`${props.item.qolip_code} • `}</Text><Text maxLines={1} overflow="ellipsis" modifiers={[weight(1)]} style={{ typography: 'titleMedium', fontWeight: '700' }}>{props.item.name}</Text></Row>
      {!!props.subtitle && <Text maxLines={1} overflow="ellipsis" style={{ typography: 'bodySmall' }}>{props.subtitle}</Text>}
    </Column></Host><View>{props.trailing}</View>
  </WorkerQueueCard>;
}
