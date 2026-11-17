import { Redirect, type Href } from 'expo-router';
import { appRoutes } from '../shared/appRoutes';
import { BrigaderFeatureAuthority } from './BrigaderFeatureContext';
import { useBrigaderFlowPage } from './BrigaderFlowProvider';
import { BrigaderPaddons } from './BrigaderPaddons';
import { BrigaderApparatusPage } from './BrigaderApparatusPages';
import { BrigaderApparatusScreen } from './BrigaderApparatusScreen';
import { BrigaderItemCreate } from './BrigaderItemCreate.android';
import { BrigaderItemDetail } from './BrigaderItemDetail.android';
import { BrigaderCustomerCreateFlow } from './BrigaderCustomerCreateFlow.android';

export function BrigaderFlowRoute() {
  const page = useBrigaderFlowPage();
  if (!page.entry) return <Redirect href={'/android-brigader' as Href} />;
  if (!page.current()) return null;
  const route = page.entry.target.route;
  const content = route === appRoutes.adminItemCreate ? <BrigaderItemCreate /> : route === appRoutes.adminItemBulkMove ? <BrigaderItemCreate bulk /> : route === appRoutes.adminItemDetail ? <BrigaderItemDetail /> : route === appRoutes.adminUserCreate ? <BrigaderCustomerCreateFlow /> : route === appRoutes.adminApparatusSettings ? <BrigaderApparatusScreen /> : route === appRoutes.apparatusPaddonDetail ? <BrigaderApparatusPage kind="detail" /> : route === appRoutes.apparatusPaddons ? <BrigaderPaddons /> : route === appRoutes.apparatusQueue ? <BrigaderApparatusPage kind="queue" /> : null;
  return <BrigaderFeatureAuthority value={{ current: page.current, interactive: page.interactive, back: page.back, args: page.entry.target.args }}>{content}</BrigaderFeatureAuthority>;
}
