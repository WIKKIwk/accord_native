import { Redirect } from 'expo-router';
import { BrigaderCalculate } from '../../../brigader/BrigaderCalculate';
import { BrigaderFeatureAuthority } from '../../../brigader/BrigaderFeatureContext';
import { useBrigaderFlowPage } from '../../../brigader/BrigaderFlowProvider';
import { BrigaderProductionMap } from '../../../brigader/BrigaderProductionMap';
import { appRoutes } from '../../../shared/appRoutes';

export default function AdminCalculationFlowRoute() {
  const page = useBrigaderFlowPage();
  if (!page.entry) return <Redirect href="/android-admin" />;
  if (!page.current()) return null;

  const { route, args } = page.entry.target;
  const content = route === appRoutes.adminCalculate ? <BrigaderCalculate /> :
    route === appRoutes.adminProductionMapTest ? <BrigaderProductionMap /> : null;
  return <BrigaderFeatureAuthority value={{ current: page.current, interactive: page.interactive, back: page.back,
    registerBackResult: page.registerBackResult, args }}>{content}</BrigaderFeatureAuthority>;
}
