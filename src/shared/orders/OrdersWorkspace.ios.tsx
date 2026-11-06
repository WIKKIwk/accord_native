import { Button, Host, NavigationStack, Picker, Text, Toolbar, ToolbarItem, useNativeState } from '@expo/ui/swift-ui';
import { accessibilityLabel, frame, labelStyle, layoutPriority, lineLimit, navigationBarTitleDisplayMode, navigationTitle, pickerStyle, searchable, tag, textInputAutocapitalization, truncationMode } from '@expo/ui/swift-ui/modifiers';
import { Stack } from 'expo-router';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { WorkerProfileButton } from '../../components/WorkerProfileButton.ios';
import { visibleOrdersTabs, type OrdersWorkspaceProps } from './ordersWorkspaceTypes';

export function OrdersWorkspace({ session, tabs: tabsInput, selected, onSelect, loading, search, onSearchChange, onMenu, onProfile, children, title = 'Buyurtmalar', searchPlaceholder = 'Buyurtmani izlash' }: OrdersWorkspaceProps) {
  const query = useNativeState(search ?? '');
  const tabs = visibleOrdersTabs(tabsInput);
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
    <Stack.Screen options={{ headerShown: false }} />
    <View style={styles.container} collapsable={false}>
      <Host style={styles.container}>
        {/* Keep search and List in one native container so their content insets animate together. */}
        <NavigationStack>
          <Toolbar modifiers={[
            navigationTitle(title), navigationBarTitleDisplayMode('large'),
            searchable(query, { placement: 'navigationBarDrawer', prompt: searchPlaceholder, onChange: onSearchChange }),
            textInputAutocapitalization('never'),
          ]}>
            {children(selectedTab.id, undefined, machinePicker)}
            <Toolbar.Content>
              <ToolbarItem placement="topBarLeading">
                <Button systemImage="line.3.horizontal" label="Bo‘limlar" modifiers={[labelStyle('iconOnly')]} onPress={onMenu} />
              </ToolbarItem>
              <ToolbarItem placement="topBarTrailing">
                <WorkerProfileButton key={session.imageCacheScope} session={session} onPress={onProfile} />
              </ToolbarItem>
            </Toolbar.Content>
          </Toolbar>
        </NavigationStack>
      </Host>
      {loading ? <ActivityIndicator pointerEvents="none" style={styles.loading} /> : null}
    </View>
  </>;
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loading: { position: 'absolute', alignSelf: 'center', top: 12 },
});
