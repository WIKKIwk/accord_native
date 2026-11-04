export type RecentPhotoLanding = { left: number; top: number; size: number };
export type RecentPhotoLayout = { left: number; top: number; size: number; gap: number; blurTop: number; landing: RecentPhotoLanding };
export type RecentComposerMetrics = { height: number; attachments: number };
export type RecentTileGeometry = {
  fromX: number; fromY: number; tilt: number; landX: number; landY: number; landScale: number; landRadius: number;
};
export type RecentTileFrame = {
  opacity: number; translateX: number; translateY: number; rotate: number; scale: number; ring: number; radius: number;
};

export const RECENT_PREWARM_MS = 180;
export const RECENT_HOLD_MS = 380;
export const RECENT_BACKDROP_BUDGET_MS = 700;
export const RECENT_STAGGER_MS = 26;
export const RECENT_RETRACT_STAGGER_MS = 18;
export const RECENT_RETRACT_MS = 340;
export const RECENT_FLIGHT_MS = 400;
export const RECENT_LANDING_HAPTIC_MS = 230;
export const RECENT_HANDOFF_BUDGET_MS = 1800;
export const RECENT_PRESS_SCALE = 0.84;
export const RECENT_NUDGE = 4;

// Sizes shared with the composer in ChatThreadScreen.ios.tsx and SelectedChatMediaPreview.
const TRIGGER_SIZE = 40;
const COMPOSER_EDGE = 12;
const COMPOSER_GAP = 14;
const COMPOSER_OUTER_PADDING = 8;
const COMPOSER_SURFACE_PADDING = 3;
const COMPOSER_MIN_HEIGHT = 62;
const BLUR_MARGIN = 6;
const TRAY_HEIGHT = 108;
const TRAY_PADDING_TOP = 8;
const TRAY_PADDING_LEFT = 8;
const PREVIEW_SIZE = 96;
const PREVIEW_GAP = 8;
const PREVIEW_RADIUS = 12;

const GAP = 8;
const MAX_TILE = 96;
const MIN_TILE = 40;
const COLUMNS = 4;
const TILE_RADIUS = 14;
const START_SCALE = 0.3;
const TILT_STEP = 7;
const ARC_POWER = 1.4;
const VERTICAL_SLOP = 14;
const HELD_VERTICAL_SLOP = 22;
const HELD_HORIZONTAL_SLOP = 4;

const NO_BACK_SWIPE_DISTANCE = { start: 100000 };

/**
 * Stops the back swipe while the plus is held or its photos are open. react-native-screens reads
 * `gestureEnabled` only when a touch lands, too early for a finger already on the plus; the response
 * distance is read when the iOS 26 full-screen swipe tries to begin, so it can still refuse that finger.
 */
export function recentBackGesture(blocked: boolean) {
  return { gestureEnabled: !blocked, gestureResponseDistance: blocked ? NO_BACK_SWIPE_DISTANCE : undefined };
}

/** Physical spring from a SwiftUI-style response (period in seconds) and damping fraction. */
function spring(response: number, dampingRatio: number) {
  const omega = (2 * Math.PI) / response;
  return { mass: 1, stiffness: omega * omega, damping: 2 * dampingRatio * omega };
}

export const recentSprings = {
  travel: spring(0.4, 0.86),
  bloom: spring(0.44, 0.64),
  focus: spring(0.24, 0.72),
  land: spring(0.36, 0.86),
  retract: spring(0.28, 1),
  icon: spring(0.36, 0.72),
  press: spring(0.2, 0.8),
};

/**
 * The row spans the composer's width and keeps one place just above the plus, however tall the
 * composer has grown. Attachments and extra lines of text go under the blur instead of pushing it up.
 */
export function recentPhotoLayout(rootWidth: number, triggerLeft: number, triggerTop: number, composer: RecentComposerMetrics): RecentPhotoLayout {
  const size = Math.max(MIN_TILE, Math.min(MAX_TILE, (rootWidth - 2 * COMPOSER_EDGE - (COLUMNS - 1) * GAP) / COLUMNS));
  const composerBottom = triggerTop + TRIGGER_SIZE + COMPOSER_SURFACE_PADDING + COMPOSER_OUTER_PADDING;
  const singleLineSurfaceTop = composerBottom - COMPOSER_MIN_HEIGHT + COMPOSER_OUTER_PADDING;
  const surfaceTop = composerBottom - Math.max(COMPOSER_MIN_HEIGHT, composer.height) + COMPOSER_OUTER_PADDING;
  const contentTop = surfaceTop + COMPOSER_SURFACE_PADDING;
  const trayTop = composer.attachments ? contentTop : contentTop - TRAY_HEIGHT;
  const top = Math.max(8, singleLineSurfaceTop - COMPOSER_GAP - size);
  // The tray scrolls its newest slot to its trailing edge, so a full tray always receives a photo there.
  const slotLeft = triggerLeft + TRAY_PADDING_LEFT + composer.attachments * (PREVIEW_SIZE + PREVIEW_GAP);
  const lastSlotLeft = rootWidth - triggerLeft - PREVIEW_GAP - PREVIEW_SIZE;
  return {
    left: COMPOSER_EDGE, top, size, gap: GAP, blurTop: Math.max(0, Math.min(top, surfaceTop - BLUR_MARGIN)),
    landing: { left: Math.min(slotLeft, lastSlotLeft), top: trayTop + TRAY_PADDING_TOP, size: PREVIEW_SIZE },
  };
}

/**
 * The tile nearest the finger, with no dead zones in the gaps. A held tile keeps its
 * selection a little past the midpoint so a resting finger cannot flicker between two.
 */
export function recentPhotoIndex(strip: Pick<RecentPhotoLayout, 'left' | 'top' | 'size' | 'gap'> & { photos: readonly unknown[] },
  root: { x: number; y: number }, x: number, y: number, held: number | null = null): number | null {
  const relativeX = x - root.x - strip.left;
  const relativeY = y - root.y - strip.top;
  const step = strip.size + strip.gap;
  const rowWidth = strip.photos.length * step - strip.gap;
  const verticalSlop = held === null ? VERTICAL_SLOP : HELD_VERTICAL_SLOP;
  if (relativeY < -verticalSlop || relativeY > strip.size + verticalSlop) return null;
  if (relativeX < -VERTICAL_SLOP || relativeX > rowWidth + VERTICAL_SLOP) return null;
  if (held !== null && Math.abs(relativeX - (held * step + strip.size / 2)) <= step / 2 + HELD_HORIZONTAL_SLOP) return held;
  return Math.max(0, Math.min(strip.photos.length - 1, Math.floor((relativeX + strip.gap / 2) / step)));
}

/** Offsets from a tile's resting place to the plus button and to its attachment preview slot. */
export function recentTileGeometry(strip: RecentPhotoLayout & { triggerLeft: number; triggerTop: number; photos: readonly unknown[] }, index: number): RecentTileGeometry {
  const centerX = strip.left + index * (strip.size + strip.gap) + strip.size / 2;
  const centerY = strip.top + strip.size / 2;
  const landScale = strip.landing.size / strip.size;
  return {
    fromX: strip.triggerLeft + TRIGGER_SIZE / 2 - centerX,
    fromY: strip.triggerTop + TRIGGER_SIZE / 2 - centerY,
    tilt: (index - (strip.photos.length - 1) / 2) * TILT_STEP,
    landX: strip.landing.left + strip.landing.size / 2 - centerX,
    landY: strip.landing.top + strip.landing.size / 2 - centerY,
    landScale,
    landRadius: PREVIEW_RADIUS / landScale,
  };
}

/**
 * One frame of a tile's motion. `travel` and `bloom` run 0 (inside the plus) to 1 (in the row);
 * `focus` runs -1 (a neighbour is held) to 1 (held); `land` runs 0 (in the row) to 1 (in its slot).
 * The horizontal path trails the vertical one, so tiles rise before fanning out along an arc.
 */
export function recentTileFrame(travel: number, bloom: number, focus: number, nudge: number, land: number, geometry: RecentTileGeometry): RecentTileFrame {
  'worklet';
  const held = Math.max(focus, 0);
  const dimmed = Math.max(-focus, 0);
  const inRow = 1 - land;
  const arc = travel > 0 ? Math.pow(travel, ARC_POWER) : travel;
  const rowScale = (START_SCALE + (1 - START_SCALE) * bloom) * (1 + 0.08 * held - 0.05 * dimmed);
  return {
    opacity: Math.max(0, Math.min(1, travel / 0.3)) * (1 - 0.4 * dimmed),
    translateX: geometry.fromX * (1 - arc) + nudge * inRow + geometry.landX * land,
    translateY: geometry.fromY * (1 - travel) - 7 * held * inRow + geometry.landY * land,
    rotate: geometry.tilt * (1 - travel) + 3 * Math.sin(Math.PI * Math.max(0, Math.min(1, land))),
    scale: rowScale * inRow + geometry.landScale * land,
    ring: held * Math.max(0, inRow),
    radius: TILE_RADIUS * inRow + geometry.landRadius * land,
  };
}
