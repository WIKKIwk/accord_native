import { SymbolView } from 'expo-symbols';
import { useEffect, useRef, useState, type ComponentRef } from 'react';
import { ActivityIndicator, FlatList, Platform, Text, View } from 'react-native';
import { useWorkerColors } from '../components/useWorkerColors';
import { WorkerSheetButton } from '../components/WorkerSheetButton';
import { QolipProductTransferControls, QolipProductTransferRow } from './QolipProductTransferNative';
import { QolipProductDragHandle, useQolipProductDrag } from './useQolipProductDrag';
import { useQolipProductTransfer } from './useQolipProductTransfer';
import type { QolipTransferProduct } from './qolipProductTransferState';

export function QolipProductTransferContent() {
  const model = useQolipProductTransfer(), colors = useWorkerColors(), root = useRef<ComponentRef<typeof View>>(null), sourceList = useRef<FlatList<QolipTransferProduct>>(null), targetList = useRef<FlatList<QolipTransferProduct>>(null);
  const drag = useQolipProductDrag(model, root), [ratio, setRatio] = useState(0.5), [height, setHeight] = useState(0), pointer = useRef<number | null>(null);
  useEffect(() => {
    if (!model.scrollRequest) return;
    const ref = model.source?.code.trim().toLowerCase() === model.scrollRequest.code ? sourceList : targetList;
    ref.current?.scrollToOffset({ offset: 0, animated: false });
  }, [model.scrollRequest, model.source]);
  if (model.loading) return <View style={{ flex: 1, justifyContent: 'center' }}><ActivityIndicator /></View>;
  if (model.error) return <WorkerSheetButton label={model.text('action.retry')} onPress={() => { void model.controller.reload(); }} />;
  const disabled = model.saving || model.scanning;
  const pane = (side: 'source' | 'target') => {
    const product = model[side], rows = model.controller.forProduct(product);
    const isTarget = drag.drag && product && drag.drag.source.code.trim().toLowerCase() !== product.code.trim().toLowerCase();
    return <View ref={value => drag.zone(side, value)} collapsable={false} style={{ flex: 1, borderRadius: 20, overflow: 'hidden', borderWidth: isTarget ? 2 : 0, borderColor: colors.icon }}>
      {!product ? <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}><Text style={{ color: colors.text }}>{model.text(`product_transfer.${side}`)}</Text></View>
        : <FlatList ref={side === 'source' ? sourceList : targetList} data={rows} keyExtractor={(item, index) => `${item.qolip_code}:${index}`} scrollEnabled={!drag.drag}
          ListEmptyComponent={<View style={{ padding: 24, alignItems: 'center' }}><Text style={{ color: colors.text }}>{model.text('product_transfer.empty')}</Text></View>}
          renderItem={({ item, index }) => <QolipProductTransferRow item={item} index={index} first={index === 0} last={index === rows.length - 1}
            selected={model.selected.has(item.qolip_code.trim().toLowerCase())} disabled={disabled || item.is_in_use} subtitle={model.subtitle(item)}
            onToggle={() => model.controller.toggle(item.qolip_code.trim().toLowerCase(), product)} trailing={<QolipProductDragHandle drag={drag} product={product} item={item} enabled={!disabled && !item.is_in_use}>
              <SymbolView name={Platform.OS === 'android' ? { android: 'drag_handle' } : 'line.3.horizontal'} size={24} tintColor={colors.icon} />
            </QolipProductDragHandle>} />}
        />}
    </View>;
  };
  return <View ref={root} style={{ flex: 1, paddingHorizontal: 12, paddingTop: 12, paddingBottom: 16 }}>
    <QolipProductTransferControls hint={model.text('product_transfer.hint')} scanLabel={model.text('scanner.title.mold')} refreshLabel={model.text('tasks.check')}
      disabled={disabled} scan={() => { void model.controller.scanSource(); }} refresh={() => { void model.controller.reload(); }} />
    <View style={{ flex: 1, paddingTop: 8 }} onLayout={event => setHeight(event.nativeEvent.layout.height)}>
      <View style={{ flex: ratio * 1000, gap: 8 }}><WorkerSheetButton label={model.source?.name ?? model.text('product_transfer.source')} disabled={disabled} height={48}
        onPress={() => model.pickProduct(true)} icon={{ ios: 'shippingbox', android: 'inventory_2' }} />{pane('source')}</View>
      <View onTouchStart={event => { pointer.current = event.nativeEvent.pageY; }} onTouchMove={event => {
        const point = event.nativeEvent.pageY, previous = pointer.current; pointer.current = point;
        if (previous !== null && height > 0) setRatio(value => Math.max(0.24, Math.min(0.76, value + (point - previous) / height)));
      }} onTouchEnd={() => { pointer.current = null; }} onTouchCancel={() => { pointer.current = null; }} style={{ paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <View style={{ height: 1, flex: 1, backgroundColor: colors.icon, opacity: 0.3 }} /><View style={{ maxWidth: '80%' }}><WorkerSheetButton label={model.target?.name ?? model.text('product_transfer.target')} disabled={disabled} height={48}
          onPress={() => model.pickProduct(false)} icon={{ ios: 'folder', android: 'drive_file_move' }} /></View><View style={{ height: 1, flex: 1, backgroundColor: colors.icon, opacity: 0.3 }} />
      </View><View style={{ flex: (1 - ratio) * 1000 }}>{pane('target')}</View>
    </View>
    {drag.drag && <View pointerEvents="none" style={{ position: 'absolute', left: drag.drag.point.x - drag.origin.x - 110, top: drag.drag.point.y - drag.origin.y - 30, width: 220, borderRadius: 18, padding: 14, backgroundColor: colors.surface, opacity: 0.92 }}>
      <Text style={{ color: colors.text, fontWeight: '700' }}>{drag.drag.items[0].qolip_code}</Text>{drag.drag.items.length > 1 && <Text style={{ color: colors.text }}>{model.text('product_transfer.move', { count: drag.drag.items.length })}</Text>}
    </View>}{model.content}
  </View>;
}
