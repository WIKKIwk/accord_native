import { Redirect } from 'expo-router';
import { GScaleDashboard } from '../gscale/GScaleScreen';
import { useMaterialReceipt } from './useMaterialReceipt';

/** @v2 _MaterialGScaleControlScreen */
export function MaterialReceipt() {
  const model = useMaterialReceipt();
  if (!model.allowed) return <Redirect href="/" />;
  if (!model.args) return <Redirect href="/" />;
  return <GScaleDashboard session={model.session} args={model.args} signOut={model.onLogout} materialReceipt={model.materialReceipt} />;
}
