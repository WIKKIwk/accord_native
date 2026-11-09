import { Host, TextInput, useNativeState } from '@expo/ui';
import { useEffect } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useBaseTheme } from '../components/useBaseTheme';
import { QolipReadOnlyHomeGrid } from './QolipReadOnlyHomeGrid';
import { QolipReadOnlyRetry } from './QolipReadOnlyRetry';
import type { QolipOwnedHomeBlock } from './qolipReadOnlyHomeOwnerState';
import type { QolipHomeReadBoundary } from './qolipHomeBlockReadState';
import { useQolipHomeBlockRead } from './useQolipHomeBlockRead';
import { useReadOnlyQolipHome } from './useReadOnlyQolipHome';
import { useReadOnlyQolipSettledHomeSession } from './useReadOnlyQolipSettledHomeSession';
import { useQolipText } from './useQolipText';
import type { Session } from '../auth';

function Search({ value, change }: { value: string; change: (text: string) => void }) {
  const state = useNativeState(value), theme = useBaseTheme(), { text } = useQolipText();
  useEffect(() => { if (state.get() !== value) state.set(value); }, [state, value]);
  return <Host matchContents={{ vertical: true }}><TextInput value={state} onChangeText={change} placeholder={text('home.search')}
    autoCapitalize="none" autoCorrect={false} returnKeyType="search" textStyle={{ color: theme.colors.onSurface, fontSize: 15 }}
    style={{ width: '100%', paddingHorizontal: 16 }} /></Host>;
}
function BlockBody({ block, boundary, counts, retry }: { block: QolipOwnedHomeBlock; boundary: QolipHomeReadBoundary;
  counts: Readonly<Record<string, number>>; retry: (blockName: string) => void }) {
  const state = useQolipHomeBlockRead(block.key, block.future, block.initialLocations, boundary);
  if (state.invalid) return null;
  return <QolipReadOnlyHomeGrid locations={state.locations} loading={state.loading} error={state.error}
    refreshUnavailable={state.refreshUnavailable} searchCounts={counts} onRetry={() => retry(block.block.name)} />;
}
function ReadOnlyHome({ session, boundary }: { session: Session; boundary: QolipHomeReadBoundary }) {
  const state = useReadOnlyQolipHome(session, boundary), { text } = useQolipText(), theme = useBaseTheme(), insets = useSafeAreaInsets();
  const actions = state.actions, home = state.home;
  if (home.kind === 'invalid' || !actions || !state.boundary) return null;
  return <View style={[styles.root, { paddingTop: insets.top, backgroundColor: theme.colors.surface }]}>
    <Search value={state.search} change={actions.setSearch} />
    {home.kind === 'loading' ? <View style={styles.center}><ActivityIndicator /></View>
      : home.kind === 'refresh-unavailable' || home.kind === 'retry' ? <QolipReadOnlyRetry
        refreshUnavailable={home.kind === 'refresh-unavailable'} onRetry={actions.retryBlocks} />
        : home.kind === 'unattached' || home.kind === 'no-blocks' ? <View style={styles.center}><Text style={{ color: theme.colors.onSurface }}>
          {text(home.kind === 'unattached' ? 'home.no_blocks_attached' : 'home.no_blocks_added')}</Text></View>
          : home.kind === 'blocks' ? <View style={styles.root}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={styles.tabs}>
              {home.tabs.map(tab => <Pressable key={tab.key} accessibilityRole="tab" accessibilityState={{ selected: tab.selected }}
                accessibilityLabel={tab.matchCount > 0 ? `${tab.block.name}, ${text('products.mold_count', { count: tab.matchCount })}` : tab.block.name}
                testID={`qolip-home-tab-${tab.key}`} onPress={() => actions.select(tab.index)}
                style={[styles.tab, { backgroundColor: tab.selected ? theme.colors.secondaryContainer : 'transparent',
                  borderBottomColor: tab.matchCount > 0 ? '#2E7D32' : tab.selected ? theme.colors.primary : 'transparent' }]}>
                <Text numberOfLines={1} style={{ color: tab.matchCount > 0 ? '#2E7D32' : tab.selected ? theme.colors.primary : theme.colors.onSurfaceVariant,
                  fontWeight: tab.selected || tab.matchCount > 0 ? '700' : '400' }}>{tab.block.name}{tab.matchCount > 0 ? ` ${tab.matchCount}` : ''}</Text>
              </Pressable>)}
            </ScrollView>
            <View style={styles.root}>{state.blocks.map(block => {
              const selected = block.key === home.selected.key;
              return <View key={block.key} style={selected ? styles.root : styles.hidden} pointerEvents={selected ? 'auto' : 'none'}
                accessibilityElementsHidden={!selected} importantForAccessibility={selected ? 'auto' : 'no-hide-descendants'}>
                <BlockBody block={block} boundary={state.boundary!} counts={home.cellCounts[block.key] ?? {}} retry={actions.retryBlock} />
              </View>;
            })}</View>
          </View> : null}
  </View>;
}

/** Unrouted candidate: one reviewed shared witness, reads, search, tabs and explicit failed-read retry. */
export function QolipReadOnlyHomeShell() {
  const entry = useReadOnlyQolipSettledHomeSession();
  return entry.kind === 'ready' ? <ReadOnlyHome session={entry.session} boundary={entry.boundary} /> : null;
}
const styles = StyleSheet.create({
  root: { flex: 1 }, center: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 },
  tabs: { flexDirection: 'row', alignItems: 'stretch' }, tab: { minWidth: 72, minHeight: 38, paddingHorizontal: 14,
    justifyContent: 'center', alignItems: 'center', borderBottomWidth: 3 }, hidden: { display: 'none' },
});
