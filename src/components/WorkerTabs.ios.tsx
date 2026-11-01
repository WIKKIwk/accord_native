import { Host, Picker, Text } from '@expo/ui/swift-ui';
import { accessibilityLabel, frame, layoutPriority, lineLimit, pickerStyle, tag, truncationMode } from '@expo/ui/swift-ui/modifiers';
import { Stack } from 'expo-router';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { getWorkerTabs, type WorkerTabsProps } from './workerTabModel';

export function WorkerTabs({ machines, selected, onSelect, loading, onSearchChange, onMenu, onProfile, children }: WorkerTabsProps) {
  const tabs = getWorkerTabs(machines);
  const selectedTab = tabs.find(tab => tab.id === selected) ?? tabs[0];
  const machinePicker = <Picker label="" selection={selectedTab.id} onSelectionChange={id => {
    if (typeof id === 'string' && tabs.some(tab => tab.id === id)) onSelect(id);
  }} modifiers={[
    pickerStyle('menu'), accessibilityLabel(`Apparat: ${selectedTab.name}`),
    lineLimit(1), truncationMode('tail'), frame({ minWidth: 60 }), layoutPriority(-1),
  ]}>
    {tabs.map(tab => <Text key={tab.id} modifiers={[tag(tab.id)]}>{tab.name}</Text>)}
  </Picker>;

  return <>
    <Stack.Screen options={{
      title: 'Buyurtmalar',
      headerShown: true,
      headerLargeTitle: true,
      headerLargeTitleShadowVisible: false,
      headerShadowVisible: false,
      headerTransparent: true,
      scrollEdgeEffects: { top: 'soft' },
      headerSearchBarOptions: {
        placeholder: 'Buyurtmani izlash',
        autoCapitalize: 'none',
        hideNavigationBar: false,
        hideWhenScrolling: true,
        placement: 'stacked',
        obscureBackground: false,
        onChangeText: event => onSearchChange?.(event.nativeEvent.text),
        onCancelButtonPress: () => onSearchChange?.(''),
      },
    }} />
    <Stack.Toolbar placement="left">
      <Stack.Toolbar.Button icon="line.3.horizontal" accessibilityLabel="Bo‘limlar" onPress={onMenu} />
    </Stack.Toolbar>
    <Stack.Toolbar placement="right">
      <Stack.Toolbar.Button icon="person.crop.circle" accessibilityLabel="Profil" onPress={onProfile} />
    </Stack.Toolbar>
    <View style={styles.container} collapsable={false}>
      <Host style={styles.container}>{children(selectedTab.id, undefined, machinePicker)}</Host>
      {loading ? <ActivityIndicator pointerEvents="none" style={styles.loading} /> : null}
    </View>
  </>;
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loading: { position: 'absolute', alignSelf: 'center', top: 12 },
});
