import { type ReactNode, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View, type ColorValue } from 'react-native';
import { GestureDetector, useExclusiveGestures, usePanGesture, useTapGesture } from 'react-native-gesture-handler';
import { finishQolipTabDrag, previewQolipTabDrag, qolipTabDragTarget, startQolipTabDrag,
  type QolipTabDrag, type QolipTabLayout } from './qolipBlockTabDrag';
import type { QolipHomeTab } from './qolipHomePresentation';

type Props = {
  tabs: readonly QolipHomeTab[];
  onSelect: (index: number) => void;
  onReorder: (oldIndex: number, newIndex: number) => void;
  label: (tab: QolipHomeTab) => string;
  renderLabel: (tab: QolipHomeTab) => ReactNode;
  colors: { surface: ColorValue; selected: ColorValue; dragging: ColorValue; underline: ColorValue; match: ColorValue };
};
type DragActions = {
  start: (key: string, absoluteX: number, localX: number) => void;
  move: (absoluteX: number) => void;
  finish: (absoluteX: number, canceled: boolean) => void;
  cancel: () => void;
  select: (key: string) => void;
};

function BlockTab({ tab, dragging, colors, label, renderLabel, recordLayout, actions }: {
  tab: QolipHomeTab; dragging: boolean; colors: Props['colors']; label: string; renderLabel: Props['renderLabel'];
  recordLayout: (key: string, layout: QolipTabLayout) => void; actions: DragActions;
}) {
  const pan = usePanGesture({ runOnJS: true, activateAfterLongPress: 500, minDistance: 0,
    onActivate: event => actions.start(tab.key, event.absoluteX, event.x),
    onUpdate: event => actions.move(event.absoluteX),
    onDeactivate: event => actions.finish(event.absoluteX, event.canceled), onFinalize: actions.cancel });
  const tap = useTapGesture({ runOnJS: true, onActivate: () => actions.select(tab.key) });
  const gesture = useExclusiveGestures(pan, tap);
  return <View onLayout={event => recordLayout(tab.key, event.nativeEvent.layout)}>
    <GestureDetector gesture={gesture}>
      <View collapsable={false} accessible accessibilityRole="tab" accessibilityLabel={label}
        accessibilityState={{ selected: tab.selected }} accessibilityActions={[{ name: 'activate' }]}
        onAccessibilityAction={event => { if (event.nativeEvent.actionName === 'activate') actions.select(tab.key); }}
        testID={`qolip-home-tab-${tab.key}`} style={[styles.tab, {
          backgroundColor: dragging ? colors.dragging : tab.selected ? colors.selected : 'transparent',
          borderBottomWidth: tab.selected || tab.matchCount > 0 ? 3 : 2,
          borderBottomColor: tab.matchCount > 0 ? colors.match : tab.selected ? colors.underline : 'transparent',
        }]}>{renderLabel(tab)}</View>
    </GestureDetector>
  </View>;
}

/** Expo UI has no reorderable tab strip. Gesture/measurement glue is shared; labels stay platform-native. */
export function QolipHomeBlockTabs(props: Props) {
  const latest = useRef(props), mounted = useRef(true), layouts = useRef(new Map<string, QolipTabLayout>());
  useLayoutEffect(() => { latest.current = props; }, [props]);
  const currentDrag = useRef<QolipTabDrag | null>(null), [drag, setDrag] = useState<QolipTabDrag | null>(null);
  const cancel = useCallback(() => {
    if (currentDrag.current === null) return;
    currentDrag.current = null;
    if (mounted.current) setDrag(null);
  }, []);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; currentDrag.current = null; }; }, []);
  useEffect(() => {
    const keys = new Set(props.tabs.map(tab => tab.key));
    for (const key of layouts.current.keys()) if (!keys.has(key)) layouts.current.delete(key);
    if (currentDrag.current && !keys.has(currentDrag.current.key)) cancel();
  }, [props.tabs, cancel]);
  const actions: DragActions = {
    start: (key, absoluteX, localX) => {
      if (!mounted.current) return;
      const next = startQolipTabDrag(latest.current.tabs, key, layouts.current, absoluteX, localX);
      currentDrag.current = next; setDrag(next);
    },
    move: absoluteX => {
      const active = currentDrag.current;
      if (!mounted.current || !active) return;
      const targetIndex = qolipTabDragTarget(latest.current.tabs, active.centers, absoluteX);
      if (targetIndex < 0 || targetIndex === active.targetIndex) return;
      const next = { ...active, targetIndex }; currentDrag.current = next; setDrag(next);
    },
    finish: (absoluteX, canceled) => {
      if (!mounted.current) return;
      const move = canceled ? null : finishQolipTabDrag(latest.current.tabs, currentDrag.current, absoluteX);
      cancel();
      if (move) latest.current.onReorder(move.oldIndex, move.newIndex);
    },
    cancel,
    select: key => {
      if (!mounted.current || currentDrag.current) return;
      const index = latest.current.tabs.findIndex(tab => tab.key === key);
      if (index >= 0) latest.current.onSelect(latest.current.tabs[index].index);
    },
  };
  const displayed = previewQolipTabDrag(props.tabs, drag);
  return <View style={{ backgroundColor: props.colors.surface }}>
    <ScrollView horizontal scrollEnabled={drag === null} showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.strip}>
      {displayed.map(tab => <BlockTab key={tab.key} tab={tab} dragging={drag?.key === tab.key} colors={props.colors}
        label={props.label(tab)} renderLabel={props.renderLabel} actions={actions}
        recordLayout={(key, layout) => { layouts.current.set(key, { x: layout.x, width: layout.width }); }} />)}
    </ScrollView>
  </View>;
}
const styles = StyleSheet.create({
  strip: { flexDirection: 'row', alignItems: 'stretch' },
  tab: { minWidth: 72, minHeight: 38, paddingHorizontal: 14, justifyContent: 'center', alignItems: 'center' },
});
