import { BrigaderPrimaryAction } from './BrigaderPrimaryAction';
import { AdminOwnedDock } from '../admin/AdminOwnedDock.ios';
import type { AdminDockTab } from '../admin/adminDockModel';
import { appRoutes } from '../shared/appRoutes';
import { useBrigaderPage } from './useBrigaderPage';

/** Native SwiftUI controls share the same source dock navigation and original account authority. */
export function BrigaderBottomBar({ active, primary = true }: { active: AdminDockTab | null; primary?: boolean }) {
  const page = useBrigaderPage(appRoutes.brigaderHome);
  return <><AdminOwnedDock active={active} isCurrent={page.current} canInteract={page.interactive} />
    {primary ? <BrigaderPrimaryAction isCurrent={page.current} canInteract={page.interactive} /> : null}</>;
}
