import { router, type Href } from 'expo-router';
import { WorkerInventoryScreen } from '../components/WorkerInventoryScreen.android';
import { useMaterialContext } from './MaterialContext';

/** @v2 InventoryMovementsScreen */
export function MaterialMovements() {
  const { session } = useMaterialContext();
  return <WorkerInventoryScreen session={session} onBack={() => {
    if (router.canGoBack()) router.back(); else router.navigate('/android-material' as Href);
  }} />;
}
