import { Button, Host, HStack, List, ProgressView, Spacer, Text, TextField, Toggle, VStack, useNativeState } from '@expo/ui/swift-ui';
import { accessibilityIdentifier, accessibilityLabel, buttonStyle, labelStyle, labelsHidden, onAppear, onLongPressGesture } from '@expo/ui/swift-ui/modifiers';
import { useWindowDimensions } from 'react-native';
import { localizedGetter } from '../shared/localization';
import { qolipPlacementPickerSubtitle, qolipPlacementPickerTitle, qolipPlacementProductKey } from './qolipCellPlacement';
import type { QolipCellPickerProps } from './qolipCellPickerProps';
import { useQolipCellPicker } from './useQolipCellPicker';
import { useQolipText } from './useQolipText';

// Reused by the cell-attach sheet; it is not a routed role surface yet.
export function QolipCellPicker({ placement, close, single, multiple }: QolipCellPickerProps) {
  const state = useQolipCellPicker(placement), search = useNativeState(''), { text, locale } = useQolipText();
  const { height } = useWindowDimensions(), selecting = state.selected.size > 0;
  return <Host style={{ height: height * 0.66 }}><VStack alignment="leading" spacing={12}>
    <HStack><Text>{selecting ? text('products.mold_count', { count: state.selected.size }) : text('home.mold_select_title')}</Text><Spacer />
      {selecting && <Button label={text('action.confirm_selected')} systemImage="checkmark" onPress={() => multiple(state.selectedProducts)}
        modifiers={[labelStyle('iconOnly'), accessibilityLabel(text('action.confirm_selected'))]} />}
      <Button label={localizedGetter('closeAction', locale)} systemImage="xmark" onPress={close}
        modifiers={[labelStyle('iconOnly'), accessibilityLabel(localizedGetter('closeAction', locale))]} />
    </HStack>
    <TextField text={search} placeholder={text('home.mold_code_customer_search')} onTextChange={value => state.controller.setQuery(value)} />
    {state.loading ? <ProgressView /> : state.error ? <VStack>
      <Text>{localizedGetter('serverDisconnectedRetry', locale)}</Text>
      <Button label={localizedGetter('retry', locale)} onPress={() => { void state.controller.retry(); }} />
    </VStack> : state.visibleItems.length === 0 ? <Text>{localizedGetter('noRecordsYet', locale)}</Text> : <List>
      {state.visibleItems.map((item, index) => {
        const key = qolipPlacementProductKey(item), selected = state.selected.has(key);
        return <HStack key={key}>
          <Button modifiers={[buttonStyle('plain'), accessibilityIdentifier(`qolip-picker-row-${key}`), onLongPressGesture(() => state.controller.toggle(item)),
            ...(index === state.visibleItems.length - 1 && state.hasMore ? [onAppear(() => { void state.controller.loadMore(); })] : [])]}
            onPress={() => { const picked = state.controller.tap(item); if (picked) single(picked); }}>
            <VStack alignment="leading"><Text>{qolipPlacementPickerTitle(item)}</Text><Text>{qolipPlacementPickerSubtitle(item)}</Text></VStack>
          </Button><Spacer />
          {selecting && <Toggle isOn={selected} onIsOnChange={() => state.controller.toggle(item)}
            modifiers={[labelsHidden(), accessibilityLabel(qolipPlacementPickerTitle(item))]} />}
        </HStack>;
      })}
      {state.loadingMore && <ProgressView />}
    </List>}
  </VStack></Host>;
}
