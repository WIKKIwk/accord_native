import { Box, Column, Host, Row, Text, TextButton, useMaterialColors } from '@expo/ui/jetpack-compose';
import { background, clip, Shapes, size, testID } from '@expo/ui/jetpack-compose/modifiers';
import { useState } from 'react';
import { ActivityIndicator, StyleSheet, View, useColorScheme } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { localizedGetter } from '../shared/localization';
import { OrdersHeader } from '../shared/orders/OrdersHeader';
import { QolipHomeBlockTabs } from './QolipHomeBlockTabs';
import type { QolipHomeContentProps } from './qolipHomeContentProps';
import { useQolipText } from './useQolipText';

// Read-only outer content only. No route, role runtime, mutation action or QolipHomeScreen coverage tag.
export function QolipHomeContent(props: QolipHomeContentProps) {
  const { home } = props, { text, locale } = useQolipText(), insets = useSafeAreaInsets(), colors = useMaterialColors();
  const [searchFocused, setSearchFocused] = useState(false), scheme = useColorScheme();
  const matchColor = scheme === 'dark' ? '#81C784' : '#2E7D32';
  if (home.kind === 'invalid') return null;
  return <View style={[styles.root, { backgroundColor: colors.surfaceContainerLow, paddingTop: insets.top }]}>
    <OrdersHeader search={props.search} searchPlaceholder={text('home.search')} onSearchChange={props.onSearchChange}
      onMenu={props.onMenu} onProfile={props.onProfile} showProfile={!searchFocused}
      onSearchFocus={() => setSearchFocused(true)} onSearchBlur={() => setSearchFocused(false)} />
    {home.kind === 'loading' ? <View style={styles.center}><ActivityIndicator /></View>
      : home.kind === 'retry' ? <View style={styles.retry}><Host matchContents><Column verticalArrangement={{ spacedBy: 16 }}>
        <Text>{localizedGetter('serverDisconnectedRetry', locale)}</Text>
        <TextButton onClick={() => { void props.retry().catch(() => {}); }} modifiers={[testID('qolip-home-retry')]}>
          <Text>{localizedGetter('retry', locale)}</Text>
        </TextButton>
      </Column></Host></View>
      : home.kind === 'unattached' || home.kind === 'no-blocks' ? <View style={styles.center}><Host matchContents>
        <Text>{text(home.kind === 'unattached' ? 'home.no_blocks_attached' : 'home.no_blocks_added')}</Text>
      </Host></View>
      : home.kind === 'blocks' ? <View style={styles.root}>
        <QolipHomeBlockTabs tabs={home.tabs} onSelect={props.onSelectBlock} onReorder={props.onReorderBlocks}
          colors={{ surface: colors.surfaceContainer, selected: colors.primaryContainer, dragging: colors.surfaceContainerHigh,
            underline: colors.primary, match: matchColor }}
          label={tab => tab.matchCount > 0 ? `${tab.block.name}, ${text('products.mold_count', { count: tab.matchCount })}` : tab.block.name}
          renderLabel={tab => <Host matchContents><Row verticalAlignment="center" horizontalArrangement={{ spacedBy: 6 }}>
            <Text maxLines={1} overflow="ellipsis" color={tab.matchCount > 0 ? matchColor : tab.selected ? colors.primary : colors.onSurfaceVariant}
              style={{ typography: 'bodyMedium', fontWeight: tab.selected || tab.matchCount > 0 ? '700' : '400' }}>{tab.block.name}</Text>
            {tab.matchCount > 0 && <Box contentAlignment="center" modifiers={[size(18, 18), clip(Shapes.Circle), background('#2E7D32')]}>
              <Text color="#FFFFFF" style={{ typography: 'labelSmall', fontWeight: '900' }}>{String(tab.matchCount)}</Text>
            </Box>}
          </Row></Host>} />
        <View key={home.selected.key} style={styles.root}>{props.renderBlock(home.selected.block, {
          index: home.selected.index, searchCounts: home.cellCounts[home.selected.key] ?? {},
          refresh: () => props.refreshBlock(home.selected.block.name),
        })}</View>
      </View> : null}
    {props.dock}
  </View>;
}
const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  retry: { flex: 1, alignItems: 'center', paddingHorizontal: 24, paddingVertical: 40 },
});
