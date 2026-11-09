import { Keyboard } from 'react-native';

export type CustomerDockDestination = 'home' | 'notifications';
type CustomerDockAction = { type: 'NAVIGATE'; payload: { name: string; pop: true } };
type Request = { destination: CustomerDockDestination; active: () => CustomerDockDestination | null;
  isMounted: () => boolean; dispatch: (action: CustomerDockAction) => void };

/** @v2 AppRootNavigation.replaceRootRoute: coalesce requests until the next frame. */
export function createCustomerDockScheduler(schedule: (callback: () => void) => void, dismissKeyboard: () => void) {
  let scheduled = false, pending: CustomerDockDestination | null = null;
  return (request: Request) => {
    if (request.destination !== 'home' && request.destination !== 'notifications') return;
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

export const queueCustomerDockNavigation = createCustomerDockScheduler(callback => { requestAnimationFrame(callback); }, () => Keyboard.dismiss());
