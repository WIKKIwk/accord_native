import { router, useFocusEffect, type Href } from 'expo-router';
import { useCallback, useRef } from 'react';
import { useCustomerContext } from './CustomerContext';
import type { CustomerPlatform } from './customerNavigation';
import type { CustomerStatusKind } from './customerStore';

type Origin = 'home' | 'status' | 'notifications';

export function useCustomerNavigation(platform: CustomerPlatform) {
  const { store } = useCustomerContext(), returningFromStatus = useRef(false);
  useFocusEffect(useCallback(() => {
    if (returningFromStatus.current) { returningFromStatus.current = false; void store.refresh(); }
  }, [store]));
  const openStatus = (kind: CustomerStatusKind) => {
    returningFromStatus.current = true;
    router.push({ pathname: `/${platform}-customer/status`, params: { kind } } as Href);
  };
  const openDetail = (id: string, origin: Origin) => {
    const pathname = platform === 'ios' && origin === 'notifications'
      ? '/ios-customer/notifications/detail' : `/${platform}-customer/detail`;
    router.push({ pathname, params: { id, origin } } as Href);
  };
  const changed = (origin: string | undefined) => {
    if (origin !== 'notifications') void store.refresh();
    if (router.canGoBack()) router.back(); else router.replace(`/${platform}-customer` as Href);
  };
  return { openStatus, openDetail, changed };
}
