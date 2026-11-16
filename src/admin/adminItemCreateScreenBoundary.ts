import { isValidElement } from 'react';
import { isSynchronouslyTrue } from '../shared/camera/synchronousGuard';
import type { AdminItemCreateScreenAssemblyProps } from './AdminItemCreateScreenAssemblyTypes';
import type { AdminItemCreateDialogPortal } from './AdminItemCreateDialogTypes';
import type { AdminPresentationWindowObserver } from './adminPresentationWindow';

/** Missing genuine presentation dependencies are rejected before a domain owner can start any read. */
export function adminItemCreateScreenBoundary(props: AdminItemCreateScreenAssemblyProps): boolean {
  if (typeof props.isCurrent !== 'function' || typeof props.canInteract !== 'function' || typeof props.onBack !== 'function' || typeof props.backLabel !== 'string' || typeof props.topNoticeDismissLabel !== 'string' || typeof props.renderPrimaryAction !== 'function' ||
    !isValidElement(props.profileAction) || props.footer == null || props.footer === false ||
    props.sourceScaffoldAncestor !== null && (typeof props.sourceScaffoldAncestor !== 'object' || !props.sourceScaffoldAncestor)) throw TypeError('Item creation requires its original native navigation, profile, dock and Source Scaffold ancestry');
  if (!isSynchronouslyTrue(props.isCurrent)) return false;
  const target = props.fixedSnackBars;
  if (!target || typeof target.enqueue !== 'function' || typeof target.render !== 'function' || !isSynchronouslyTrue(target.isAvailable)) throw TypeError('Item creation requires its genuine shared fixed SnackBar target');
  return isSynchronouslyTrue(props.isCurrent);
}
export function requireAdminItemCreateAndroidPresentation(portal: AdminItemCreateDialogPortal, observer: AdminPresentationWindowObserver): void {
  if (!portal || typeof portal.render !== 'function' || !isSynchronouslyTrue(portal.isAvailable) || !observer ||
    ['arm', 'waitForDetach', 'cancelPending', 'cancel'].some(key => typeof observer[key as keyof AdminPresentationWindowObserver] !== 'function')) throw TypeError('Item creation requires its genuine original Android dialog portal and native window observer');
}
