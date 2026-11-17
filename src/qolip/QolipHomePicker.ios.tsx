import { Button, Host, HStack, List, ProgressView, Spacer, Text, TextField, Toggle, VStack, useNativeState } from '@expo/ui/swift-ui';
import { buttonStyle, frame, labelStyle, labelsHidden, onAppear, onLongPressGesture } from '@expo/ui/swift-ui/modifiers';
import { useWindowDimensions } from 'react-native';
import { localizedGetter } from '../shared/localization';
import type { QolipHomePickerProps } from './qolipHomePickerTypes';
import { useQolipHomePicker } from './useQolipHomePicker';
import { useQolipText } from './useQolipText';

export function QolipHomePicker<T>(props: QolipHomePickerProps<T>) {
  const model = useQolipHomePicker(props), input = useNativeState(''), { height } = useWindowDimensions(), { text, locale } = useQolipText();
  if (!model.valid) return null;
  return <Host style={{ height: height * 0.66 }}><VStack alignment="leading" spacing={12}>
    <HStack><Text>{model.selected.size ? text('products.mold_count', { count: model.selected.size }) : props.title}</Text><Spacer />
      {model.selected.size > 0 && <Button label={text('action.confirm_selected')} systemImage="checkmark" onPress={model.confirm} modifiers={[labelStyle('iconOnly')]} />}
      <Button label={localizedGetter('closeAction', locale)} systemImage="xmark" onPress={props.close} modifiers={[labelStyle('iconOnly')]} />
    </HStack><TextField text={input} placeholder={props.hint} onTextChange={model.setQuery} />
    {model.error ? <VStack><Text>{localizedGetter('serverDisconnectedRetry', locale)}</Text><Button label={localizedGetter('retry', locale)} onPress={model.retry} /></VStack>
      : model.busy && !model.items.length ? <ProgressView /> : <List>
        {model.items.map((item, index) => <HStack key={props.itemKey(item)}><Button onPress={() => model.tap(item)} modifiers={[buttonStyle('plain'), frame({ minHeight: 48, maxWidth: Infinity, alignment: 'leading' }),
          ...(props.multiple ? [onLongPressGesture(() => model.toggle(item))] : []), ...(index === model.items.length - 1 && model.more ? [onAppear(model.loadMore)] : [])]}>
          <VStack alignment="leading"><Text>{props.itemTitle(item)}</Text><Text>{props.itemSubtitle(item)}</Text></VStack></Button>
          {model.selected.size > 0 && <Toggle isOn={model.selected.has(props.itemKey(item))} onIsOnChange={() => model.toggle(item)} modifiers={[labelsHidden()]} />}
        </HStack>)}
        {model.busy && <ProgressView />}{!model.busy && !model.items.length && <Text>{localizedGetter('noRecordsYet', locale)}</Text>}
      </List>}
  </VStack></Host>;
}
