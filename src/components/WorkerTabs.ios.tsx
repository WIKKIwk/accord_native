import { Host, RNHostView } from '@expo/ui/swift-ui';
import { Stack } from 'expo-router';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { WorkerTabStrip } from './WorkerTabStrip.ios';
import { getWorkerTabs, type WorkerTabsProps } from './workerTabModel';

export function WorkerTabs({ machines, selected, onSelect, loading, onSearchChange, onMenu, onProfile, children }: WorkerTabsProps) {
  const tabs = getWorkerTabs(machines);
  const selectedTab = tabs.find(tab => tab.id === selected) ?? tabs[0];
  const tabsHeader = <RNHostView matchContents={{ vertical: true }}>
    <WorkerTabStrip tabs={tabs} selected={selectedTab.id} onSelect={onSelect} />
  </RNHostView>;

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
      <Host style={styles.container}>{children(selectedTab.id, undefined, tabsHeader)}</Host>
      {loading ? <ActivityIndicator pointerEvents="none" style={styles.loading} /> : null}
    </View>
  </>;
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loading: { position: 'absolute', alignSelf: 'center', top: 12 },
});
