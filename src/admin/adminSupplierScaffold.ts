import { useCallback, useInsertionEffect, useLayoutEffect, useRef } from 'react';
import { isSynchronouslyTrue } from '../shared/camera/synchronousGuard';
import { useAdminCreateHubScaffoldLayout } from './AdminCreateHubProvider';
import { adminSupplierBodySafeAreaBottom } from './adminSupplierScaffoldLayout';

/** Geometry cannot replace read authority. Only new interactions wait for the genuine measured Scaffold. */
export function useAdminSupplierScaffold(isCurrent: () => boolean, canInteract?: () => boolean) {
  const bodySafeAreaBottom = adminSupplierBodySafeAreaBottom(useAdminCreateHubScaffoldLayout());
  const lifetime = useRef({ active: true, measured: bodySafeAreaBottom !== null });
  useInsertionEffect(() => { const original = lifetime.current; original.active = true; return () => { original.active = false; }; }, []);
  useLayoutEffect(() => { lifetime.current.measured = bodySafeAreaBottom !== null; }, [bodySafeAreaBottom]);
  const interactive = useCallback(() => lifetime.current.active && lifetime.current.measured && isSynchronouslyTrue(isCurrent) &&
    (canInteract === undefined || isSynchronouslyTrue(canInteract)) && lifetime.current.active && lifetime.current.measured && isSynchronouslyTrue(isCurrent), [isCurrent, canInteract]);
  return { bodySafeAreaBottom, canInteractBody: interactive };
}
