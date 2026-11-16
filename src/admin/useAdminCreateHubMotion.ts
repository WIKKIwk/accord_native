import { useEffect, useRef } from 'react';
import { cancelAnimation, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import type { AdminCreateHubController, AdminCreateHubOverlay } from './adminCreateHubController';

const spatialOpen = { mass: 1.18, stiffness: 230, damping: 2 * .88 * Math.sqrt(230 * 1.18), energyThreshold: .000001 };
const spatialClose = { mass: 1.2, stiffness: 400, damping: 2 * .82 * Math.sqrt(400 * 1.2), energyThreshold: .000001 };
const effectsOpen = { mass: 1.12, stiffness: 500, damping: 2 * Math.sqrt(500 * 1.12), energyThreshold: .000001 };
const effectsClose = { mass: 1.08, stiffness: 700, damping: 2 * Math.sqrt(700 * 1.08), energyThreshold: .000001 };
const morphSpring = { mass: .55, stiffness: 2350, damping: 2 * .72 * Math.sqrt(2350 * .55), energyThreshold: .000001 };

export function useAdminCreateHubMotion(overlay: AdminCreateHubOverlay, controller: AdminCreateHubController) {
  const spatial = useSharedValue(0), morph = useSharedValue(0), effects = useSharedValue(0), current = useRef({ motion: overlay.motion, open: overlay.targetOpen, done: new Set<number>() });
  useEffect(() => {
    const motion = overlay.motion; current.current = { motion, open: overlay.targetOpen, done: new Set() };
    const complete = (channel: number) => {
      const value = current.current; if (value.motion !== motion || value.open || !controller.overlayCurrent(overlay.id, overlay.generation)) return;
      value.done.add(channel); if (value.done.size === 3) controller.closed(overlay.id, overlay.generation, motion);
    };
    spatial.set(withSpring(overlay.targetOpen ? 1 : 0, overlay.targetOpen ? spatialOpen : spatialClose, finished => { if (finished) scheduleOnRN(complete, 0); }));
    morph.set(withSpring(overlay.targetOpen ? 1 : 0, morphSpring, finished => { if (finished) scheduleOnRN(complete, 1); }));
    effects.set(withSpring(overlay.targetOpen ? 1 : 0, overlay.targetOpen ? effectsOpen : effectsClose, finished => { if (finished) scheduleOnRN(complete, 2); }));
    return () => { current.current.motion = -1; cancelAnimation(spatial); cancelAnimation(morph); cancelAnimation(effects); };
  }, [controller, overlay.id, overlay.generation, overlay.motion, overlay.targetOpen, spatial, morph, effects]);
  const backdrop = useAnimatedStyle(() => ({ opacity: Math.max(0, Math.min(1, effects.get())) }));
  return { spatial, morph, effects, backdrop };
}
