import { StyleSheet, View } from 'react-native';
import { QolipHomeBlockBody } from './QolipHomeBlockBody';
import { QolipHomeContent } from './QolipHomeContent';
import type { QolipHomeOwnerProps } from './qolipHomeOwnerProps';
import { useGuardedQolipHome } from './useGuardedQolipHome';

// Partial owner composition only. No app route, destination, scanner, printer or Chat implementation.
export function QolipHomeOwner(props: QolipHomeOwnerProps) {
  const state = useGuardedQolipHome(props.session, props.boundary), { actions, boundary } = state;
  if (state.home.kind === 'invalid' || !actions || !boundary) return null;
  return <QolipHomeContent home={state.home} search={state.search} onSearchChange={actions.setSearch}
    onMenu={() => actions.invoke(props.onMenu)} onProfile={() => actions.invoke(props.onProfile)}
    onSelectBlock={actions.select} onReorderBlocks={actions.reorder} retry={actions.retry} refreshBlock={actions.refreshBlock}
    renderRetainedBlocks={home => <View style={styles.fill}>{state.blocks.map(block => {
      const selected = block.key === home.selected.key;
      return <View key={block.key} style={selected ? styles.fill : styles.hidden} pointerEvents={selected ? 'auto' : 'none'}
        accessibilityElementsHidden={!selected} importantForAccessibility={selected ? 'auto' : 'no-hide-descendants'}>
        <QolipHomeBlockBody blockKey={block.key} future={block.future} initialLocations={block.initialLocations} boundary={boundary}
          searchCounts={home.cellCounts[block.key] ?? {}} refresh={() => actions.refreshBlock(block.block.name)}
          openCell={(...args) => actions.invoke(() => props.openCell(block.block, ...args))}
          printCell={(...args) => actions.invoke(() => props.printCell(block.block, ...args))} />
      </View>;
    })}</View>} />;
}
const styles = StyleSheet.create({ fill: { flex: 1 }, hidden: { display: 'none' } });
