import { Host, Picker, ScrollView, Text } from '@expo/ui/swift-ui';
import { accessibilityLabel, fixedSize, frame, padding, pickerStyle, tag } from '@expo/ui/swift-ui/modifiers';
import { Stack } from 'expo-router';
import { ActivityIndicator, StyleSheet, useWindowDimensions, View } from 'react-native';
import { getWorkerTabs, type WorkerTabsProps } from './workerTabModel';

export function WorkerTabs({ machines, selected, onSelect, loading, onSearchChange, onMenu, onProfile, children }: WorkerTabsProps) {
  const tabs = getWorkerTabs(machines);
  const selectedTab = tabs.find(tab => tab.id === selected) ?? tabs[0];
  const { width } = useWindowDimensions();
  const tabsHeader = <ScrollView axes="horizontal" showsIndicators={false} modifiers={[padding({ vertical: 8 })]}>
    <Picker label="" selection={selectedTab.id} onSelectionChange={id => {
      if (typeof id === 'string' && tabs.some(tab => tab.id === id)) onSelect(id);
    }} modifiers={[
      pickerStyle('segmented'), accessibilityLabel('Aparat navbatlari'),
      fixedSize({ horizontal: true, vertical: false }), frame({ minWidth: Math.max(0, width - 32) }),
    ]}>
      {tabs.map(tab => <Text key={tab.id} modifiers={[tag(tab.id)]}>{tab.name}</Text>)}
    </Picker>
  </ScrollView>;

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
