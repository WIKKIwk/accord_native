import { Keyboard } from 'react-native';

export type BoyoqchiDockDestination = 'home' | 'astatka' | 'profile' | 'chat';
type BoyoqchiDockAction = { type: 'NAVIGATE'; payload: { name: string; pop: true } };
type Request = { destination: BoyoqchiDockDestination; active: () => BoyoqchiDockDestination | '';
  isMounted: () => boolean; dispatch: (action: BoyoqchiDockAction) => void };

/** @v2 AppRootNavigation.replaceRootRoute: coalesce requests until the next frame. */
export function createBoyoqchiDockScheduler(schedule: (callback: () => void) => void, dismissKeyboard: () => void) {
  let scheduled = false, pending: BoyoqchiDockDestination | null = null;
  return (request: Request) => {
    if (request.destination === request.active()) return;
    dismissKeyboard();
    pending = request.destination;
    if (scheduled) return;
    scheduled = true;
    schedule(() => {
      scheduled = false;
      const destination = pending;
      pending = null;
      if (!destination || !request.isMounted() || destination === request.active()) return;
      request.dispatch({ type: 'NAVIGATE', payload: { name: destination === 'home' ? 'index' : destination, pop: true } });
    });
  };
}

export const queueBoyoqchiDockNavigation = createBoyoqchiDockScheduler(callback => { requestAnimationFrame(callback); }, () => Keyboard.dismiss());
