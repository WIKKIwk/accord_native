import { Button, Host, Text } from '@expo/ui';
import { type ComponentRef, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import { getWorkerTabs, type WorkerTabsProps } from './workerTabModel';

/** Non-Android pager; Android uses Expo UI's native Compose HorizontalPager. */
export function WorkerTabs({ machines, selected, onSelect, loading, children }: WorkerTabsProps) {
  const tabs = getWorkerTabs(machines);
  const selectedIndex = Math.max(0, tabs.findIndex(tab => tab.id === selected));
  const pager = useRef<ComponentRef<typeof ScrollView>>(null);
  const currentPage = useRef(selectedIndex);
  const previousWidth = useRef(0);
  const [pageWidth, setPageWidth] = useState(0);
  useEffect(() => {
    if (!pageWidth) return;
    if (currentPage.current !== selectedIndex || previousWidth.current !== pageWidth) {
      pager.current?.scrollTo({ x: selectedIndex * pageWidth, animated: previousWidth.current === pageWidth });
      currentPage.current = selectedIndex;
      previousWidth.current = pageWidth;
    }
  }, [selectedIndex, pageWidth]);

  return <View style={styles.container}>
    <View style={styles.tabBar}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
        {tabs.map(tab => <View key={tab.id} style={[styles.tab, selected === tab.id && styles.selected]}>
          <Host matchContents colorScheme="light" seedColor="#294e3e">
            <Button variant="text" onPress={() => onSelect(tab.id)} testID={`worker-tab-${tab.id}`}>
              <Text textStyle={{ fontSize: 14, fontWeight: selected === tab.id ? '700' : '500', color: selected === tab.id ? '#294e3e' : '#525f58' }}>{tab.name}</Text>
            </Button>
          </Host>
        </View>)}
      </ScrollView>
    </View>
    {loading ? <ActivityIndicator style={styles.loading} /> : null}
    <ScrollView ref={pager} style={styles.pager} horizontal pagingEnabled showsHorizontalScrollIndicator={false}
      onLayout={event => setPageWidth(event.nativeEvent.layout.width)}
      onMomentumScrollEnd={event => {
        if (!pageWidth) return;
        const page = Math.round(event.nativeEvent.contentOffset.x / pageWidth);
        currentPage.current = page;
        if (tabs[page]) onSelect(tabs[page].id);
      }}>
      {pageWidth > 0 ? tabs.map(tab => <Host key={tab.id} colorScheme="light" style={{ width: pageWidth, height: '100%' }}>
        {children(tab.id)}
      </Host>) : null}
    </ScrollView>
  </View>;
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  tabBar: { backgroundColor: '#f8f9fb', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#d5ddd5' },
  tabs: { flexDirection: 'row', alignItems: 'stretch', paddingHorizontal: 4 },
  tab: { justifyContent: 'center', borderBottomWidth: 3, borderBottomColor: 'transparent' },
  selected: { borderBottomColor: '#294e3e' },
  pager: { flex: 1 },
  loading: { padding: 20 },
});
