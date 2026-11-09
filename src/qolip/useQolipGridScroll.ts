import { useState, type ComponentRef } from 'react';
import { PanResponder, type NativeScrollEvent, type NativeSyntheticEvent, type ScrollView } from 'react-native';

type Scroll = ComponentRef<typeof ScrollView>;
/** The numbered header remains pinned but drags the horizontal grid, as in V2. */
class QolipGridScrollController {
  private scroll: Scroll | null = null;
  private offset = 0;
  private start = 0;
  private content = 0;
  private viewport = 0;
  readonly panHandlers = PanResponder.create({
    onMoveShouldSetPanResponder: (_event, gesture) => Math.abs(gesture.dx) > 5 && Math.abs(gesture.dx) > Math.abs(gesture.dy),
    onPanResponderGrant: () => { this.start = this.offset; },
    onPanResponderMove: (_event, gesture) => {
      const next = Math.max(0, Math.min(Math.max(0, this.content - this.viewport), this.start - gesture.dx));
      this.offset = next; this.scroll?.scrollTo({ x: next, animated: false });
    },
  }).panHandlers;
  bindScroll = (view: Scroll | null) => { this.scroll = view; };
  onScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => { this.offset = event.nativeEvent.contentOffset.x; };
  onContentSizeChange = (width: number) => { this.content = width; };
  onViewportWidth = (width: number) => { this.viewport = width; };
}
export function useQolipGridScroll() {
  const [controller] = useState(() => new QolipGridScrollController());
  return controller;
}
