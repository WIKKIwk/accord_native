import { DailyWorkScreen } from '../../../components/DailyWorkScreen';
import { useRezkaShellContext } from '../../../rezka/RezkaShellContext';

export default function IosRezkaDaily() {
  const { snapshot, openDrawer, navigate } = useRezkaShellContext();
  return <DailyWorkScreen session={snapshot.session} onOpenDrawer={openDrawer} onBack={() => navigate('queue')} />;
}
