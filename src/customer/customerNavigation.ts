import type { CustomerStatusKind } from './customerStore';

export type CustomerDestination = 'home' | 'notifications' | 'profile' | 'chat';
export type CustomerPlatform = 'ios' | 'android';

/** V2 CustomerNavigationDrawer and CustomerDock destinations. */
export function customerDestinationPath(platform: CustomerPlatform, destination: CustomerDestination): string {
  const root = `/${platform}-customer`;
  return destination === 'home' ? root : `${root}/${destination}`;
}

export function customerDrawerActive(pathname: string): 'home' | 'notifications' | 'profile' | undefined {
  if (/^\/(ios|android)-customer\/?$/.test(pathname)) return 'home';
  if (/^\/(ios|android)-customer\/notifications\/?$/.test(pathname)) return 'notifications';
  if (/^\/(ios|android)-customer\/profile\/?$/.test(pathname)) return 'profile';
  return undefined;
}

export function customerStatusKind(value: string | string[] | undefined): CustomerStatusKind | null {
  return value === 'pending' || value === 'confirmed' || value === 'rejected' ? value : null;
}

export function customerNotificationBadge(hasUnread: boolean, active: string | null): boolean {
  return hasUnread && active !== 'notifications';
}
