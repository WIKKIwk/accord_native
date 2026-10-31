import { SegmentedControl } from '@expo/ui/community/segmented-control';
import { Host } from '@expo/ui/swift-ui';
import { Stack } from 'expo-router';
import { ActivityIndicator, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { getWorkerTabs, type WorkerTabsProps } from './workerTabModel';

export function WorkerTabs({ machines, selected, onSelect, loading, onSearchChange, onMenu, onProfile, children }: WorkerTabsProps) {
  const tabs = getWorkerTabs(machines);
  const selectedIndex = Math.max(0, tabs.findIndex(tab => tab.id === selected));
  const selectedTab = tabs[selectedIndex];
  const { width } = useWindowDimensions();
  const controlWidth = Math.max(150, width - 144);

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
      headerTitle: () => <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ width: controlWidth, flexGrow: 0 }}>
        <SegmentedControl values={tabs.map(tab => tab.name)} selectedIndex={selectedIndex}
          style={{ width: Math.max(controlWidth, tabs.length * 110) }} accessibilityLabel="Aparat navbatlari"
          onChange={event => {
            const tab = tabs[event.nativeEvent.selectedSegmentIndex];
            if (tab) onSelect(tab.id);
          }} />
      </ScrollView>,
    }} />
    <Stack.Toolbar placement="left">
      <Stack.Toolbar.Button icon="line.3.horizontal" accessibilityLabel="Bo‘limlar" onPress={onMenu} />
    </Stack.Toolbar>
    <Stack.Toolbar placement="right">
      <Stack.Toolbar.Button icon="person.crop.circle" accessibilityLabel="Profil" onPress={onProfile} />
    </Stack.Toolbar>
    <View style={styles.container} collapsable={false}>
      <Host style={styles.container}>{children(selectedTab.id)}</Host>
      {loading ? <ActivityIndicator pointerEvents="none" style={styles.loading} /> : null}
    </View>
  </>;
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loading: { position: 'absolute', alignSelf: 'center', top: 12 },
});
