import { Button, Column, Host, Text, TextInput, useNativeState } from '@expo/ui';
import { useLayoutEffect, useRef } from 'react';
import { ActivityIndicator, FlatList, View } from 'react-native';
import { WorkerIconButton } from '../components/WorkerIconButton';
import { WerkaBatchCustomerPickerRow } from './WerkaBatchCustomerPickerRow';
import { werkaBatchCustomerPickerNearEnd, werkaBatchCustomerPickerPresentation,
  type WerkaBatchCustomerPickerContentProps } from './werkaBatchCustomerPicker';

/** Controlled picker body only. Its parent supplies and safely dismisses the actual sheet. */
export function WerkaBatchCustomerPickerContent(props: WerkaBatchCustomerPickerContentProps) {
  const view = werkaBatchCustomerPickerPresentation(props.state, props.locale), finished = useRef(false), alive = useRef(true);
  const committed = useRef(props), origin = props.state, fieldKey = props.queryFieldKey;
  useLayoutEffect(() => { committed.current = props; });
  useLayoutEffect(() => {
    alive.current = true;
    return () => { alive.current = false; };
  }, []);
  const active = () => alive.current && !finished.current;
  const currentView = () => active() && committed.current.state === origin;
  const dismiss = () => { if (active()) { finished.current = true; committed.current.onDismiss(); } };
  const select = (customer: typeof props.state.customers[number]) => {
    if (currentView() && view.body === 'list') { finished.current = true; committed.current.onSelect(customer); }
  };
  return <View style={{ flex: 1, paddingHorizontal: 12, paddingBottom: 24, gap: 14 }}>
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      <Host matchContents={{ vertical: true }} style={{ flex: 1 }}><Text textStyle={{ fontSize: 22 }}>{view.title}</Text></Host>
      <WorkerIconButton icon="close" label={props.closeLabel} onPress={dismiss} />
    </View>
    <WerkaBatchCustomerSearchField key={props.queryFieldKey} initial={props.state.query} hint={view.hint}
      onChange={query => { if (active() && committed.current.queryFieldKey === fieldKey) committed.current.onQueryChange(query); }} />
    {view.body === 'loading' ? <ActivityIndicator /> : null}
    {view.body === 'error' ? <Host matchContents={{ vertical: true }} style={{ width: '100%' }}><Column spacing={12}>
      <Text>{view.error}</Text><Button label={view.retry} variant="outlined" onPress={() => { if (currentView()) committed.current.onRetry(); }} />
    </Column></Host> : null}
    {view.body === 'empty' ? <Host matchContents={{ vertical: true }} style={{ width: '100%' }}><Text>{view.empty}</Text></Host> : null}
    {view.body === 'list' ? <FlatList data={view.rows} keyExtractor={(row, index) => `${index}:${row.customer.ref}`}
      keyboardShouldPersistTaps="handled" scrollEventThrottle={16}
      onScroll={({ nativeEvent }) => {
        if (currentView() && view.canLoadMore && werkaBatchCustomerPickerNearEnd(nativeEvent.contentOffset.y,
          nativeEvent.contentSize.height, nativeEvent.layoutMeasurement.height)) committed.current.onLoadMore();
      }}
      renderItem={({ item }) => <WerkaBatchCustomerPickerRow title={item.title} subtitle={item.subtitle} onPress={() => select(item.customer)} />}
      ListFooterComponent={view.showLoadingMore ? <ActivityIndicator /> : undefined} /> : null}
  </View>;
}

function WerkaBatchCustomerSearchField({ initial, hint, onChange }: {
  initial: string; hint: string; onChange: (query: string) => void;
}) {
  const value = useNativeState(initial), alive = useRef(true);
  useLayoutEffect(() => {
    alive.current = true;
    return () => { alive.current = false; };
  }, []);
  return <Host matchContents={{ vertical: true }} style={{ width: '100%' }}>
    <TextInput value={value} placeholder={hint} accessibilityLabel={hint} autoFocus={false}
      onChangeText={query => { if (alive.current) onChange(query); }} />
  </Host>;
}
