import { useMemo } from 'react';
import { PanResponder } from 'react-native';

function createLoginBackGesture(onBack?: () => void) {
  let triggered = false;
  return PanResponder.create({
    onMoveShouldSetPanResponderCapture: (_, gesture) => !!onBack && gesture.dx > 10 && gesture.dx > Math.abs(gesture.dy) * 1.15,
    onPanResponderGrant: () => { triggered = false; },
    onPanResponderMove: (_, gesture) => {
      if (!triggered && gesture.moveX - gesture.x0 >= 72) {
        triggered = true;
        onBack?.();
      }
    },
    onPanResponderRelease: () => { triggered = false; },
    onPanResponderTerminate: () => { triggered = false; },
  });
}

export function useLoginBackGesture(onBack?: () => void) {
  return useMemo(() => createLoginBackGesture(onBack), [onBack]);
}
