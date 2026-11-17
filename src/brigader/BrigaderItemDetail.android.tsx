import { useCallback, useState } from 'react';
import { AdminItemDetailRead } from '../admin/AdminItemDetailRead.android';
import { appRoutes } from '../shared/appRoutes';
import { BrigaderBottomBar } from './BrigaderBottomBar.android';
import { useBrigaderFeature } from './BrigaderFeatureContext';
import { useBrigaderItemDetailPresentations } from './BrigaderItemDetailPresentations';
import { BrigaderItemCreate } from './BrigaderItemCreate.android';
export function BrigaderItemDetail() {
  const page = useBrigaderFeature(appRoutes.adminItemDetail), [identity] = useState(() => ({}));
  const { back } = page;
  const removed = useCallback(() => back(true), [back]), presentations = useBrigaderItemDetailPresentations(removed);
  const code = typeof page.args === 'string' ? page.args.trim() : '';
  if (!page.current()) return null;
  if (!code) return <BrigaderItemCreate />;
  const props = { session: page.shell.session, witness: page.shell.witness, pageIdentity: identity, itemCode: code, isCurrent: page.current, canInteract: page.interactive,
    onBack: page.back, backLabel: page.backLabel, footer: <BrigaderBottomBar active="settings" primary={false} />, presentations };
  return <AdminItemDetailRead {...props} />;
}
