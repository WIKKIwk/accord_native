import { View } from 'react-native';
import { QolipHomeBlockBody } from './QolipHomeBlockBody';
import { QolipHomeContent } from './QolipHomeContent';
import { useQolipHomeScreen } from './useQolipHomeScreen';

/** @v2 QolipHomeScreen */
export function QolipHomeScreen() {
  const { role, model, actions } = useQolipHomeScreen(), owner = model.actions, boundary = model.boundary;
  if (!owner || !boundary || model.home.kind === 'invalid') return null;
  return <View style={{ flex: 1 }}><QolipHomeContent home={model.home} search={model.search} onSearchChange={owner.setSearch}
    onMenu={role.onMenu} onProfile={role.onProfile} onAddBlock={actions.addBlock} dock={role.dock}
    onSelectBlock={owner.select} onReorderBlocks={owner.reorder} retry={owner.retry} refreshBlock={owner.refreshBlock}
    renderRetainedBlocks={home => <View style={{ flex: 1 }}>{model.blocks.map(block => {
      const selected = block.key === home.selected.key;
      return <View key={block.key} style={selected ? { flex: 1 } : { display: 'none' }} pointerEvents={selected ? 'auto' : 'none'} accessibilityElementsHidden={!selected} importantForAccessibility={selected ? 'auto' : 'no-hide-descendants'}>
        <QolipHomeBlockBody blockKey={block.key} future={block.future} initialLocations={block.initialLocations} boundary={boundary}
          searchCounts={home.cellCounts[block.key] ?? {}} refresh={() => owner.refreshBlock(block.block.name)}
          openCell={(...args) => actions.openCell(block.block, ...args)} printCell={(...args) => actions.printCell(block.block, ...args)} />
      </View>;
    })}</View>} />{actions.content}</View>;
}
