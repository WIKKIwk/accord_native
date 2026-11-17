import { router, type Href } from 'expo-router';
import { WorkerInventoryScreen } from '../components/WorkerInventoryScreen';
import { useMaterialContext } from './MaterialContext';

/** Material uses the same role-aware inventory movement surface as V2. */
export function MaterialMovements() {
  const { session } = useMaterialContext();
  return <WorkerInventoryScreen session={session} onBack={() => {
    if (router.canGoBack()) router.back(); else router.navigate('/ios-material' as Href);
  }} />;
}
