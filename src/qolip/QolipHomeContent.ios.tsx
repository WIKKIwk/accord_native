import { Button, Host, HStack, ProgressView, Text, VStack } from '@expo/ui/swift-ui';
import { background, font, foregroundStyle, frame, lineLimit, shapes } from '@expo/ui/swift-ui/modifiers';
import { useState } from 'react';
import { PlatformColor, StyleSheet, View, useColorScheme } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { localizedGetter } from '../shared/localization';
import { OrdersHeader } from '../shared/orders/OrdersHeader';
import { QolipHomeBlockTabs } from './QolipHomeBlockTabs';
import type { QolipHomeContentProps } from './qolipHomeContentProps';
import { useQolipText } from './useQolipText';

// Read-only outer content only. No route, role runtime, mutation action or QolipHomeScreen coverage tag.
export function QolipHomeContent(props: QolipHomeContentProps) {
  const { home } = props, { text, locale } = useQolipText(), insets = useSafeAreaInsets();
  const [searchFocused, setSearchFocused] = useState(false), scheme = useColorScheme();
  const matchColor = scheme === 'dark' ? '#81C784' : '#2E7D32';
  if (home.kind === 'invalid') return null;
  return <View style={[styles.root, { backgroundColor: PlatformColor('systemBackground'), paddingTop: insets.top }]}>
    <OrdersHeader search={props.search} searchPlaceholder={text('home.search')} onSearchChange={props.onSearchChange}
      onMenu={props.onMenu} onProfile={props.onProfile} showProfile={!searchFocused}
      onSearchFocus={() => setSearchFocused(true)} onSearchBlur={() => setSearchFocused(false)} />
    {home.kind === 'loading' ? <View style={styles.center}><Host matchContents><ProgressView /></Host></View>
      : home.kind === 'retry' ? <View style={styles.retry}><Host matchContents><VStack spacing={16}>
        <Text>{localizedGetter('serverDisconnectedRetry', locale)}</Text>
        <Button label={localizedGetter('retry', locale)} onPress={() => { void props.retry().catch(() => {}); }} />
      </VStack></Host></View>
      : home.kind === 'unattached' || home.kind === 'no-blocks' ? <View style={styles.center}><Host matchContents>
        <Text>{text(home.kind === 'unattached' ? 'home.no_blocks_attached' : 'home.no_blocks_added')}</Text>
      </Host></View>
      : home.kind === 'blocks' ? <View style={styles.root}>
        <QolipHomeBlockTabs tabs={home.tabs} onSelect={props.onSelectBlock} onReorder={props.onReorderBlocks}
          colors={{ surface: PlatformColor('secondarySystemBackground'), selected: PlatformColor('tertiarySystemFill'),
            dragging: PlatformColor('tertiarySystemBackground'), underline: PlatformColor('systemBlue'), match: matchColor }}
          label={tab => tab.matchCount > 0 ? `${tab.block.name}, ${text('products.mold_count', { count: tab.matchCount })}` : tab.block.name}
          renderLabel={tab => <Host matchContents><HStack spacing={6}>
            <Text modifiers={[lineLimit(1), font({ size: 14, weight: tab.selected || tab.matchCount > 0 ? 'bold' : 'regular' }),
              foregroundStyle({ type: 'color', color: tab.matchCount > 0 ? matchColor : tab.selected ? PlatformColor('systemBlue') : PlatformColor('secondaryLabel') })]}>{tab.block.name}</Text>
            {tab.matchCount > 0 && <Text modifiers={[font({ size: 11, weight: 'black' }), foregroundStyle({ type: 'color', color: '#FFFFFF' }),
              frame({ width: 18, height: 18 }), background('#2E7D32', shapes.circle())]}>{String(tab.matchCount)}</Text>}
          </HStack></Host>} />
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
