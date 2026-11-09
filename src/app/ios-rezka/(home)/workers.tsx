import { router } from 'expo-router';
import { localizedGetter } from '../../../shared/localization';
import { useRezkaLocale } from '../../../rezka/useRezkaShell';
import { RezkaWorkerSettingsScreen } from '../../../rezka/RezkaWorkerSettings';
import { useRezkaShellContext } from '../../../rezka/RezkaShellContext';

export default function IosRezkaWorkers() {
  const { snapshot, openDrawer } = useRezkaShellContext(), locale = useRezkaLocale();
  return <RezkaWorkerSettingsScreen session={snapshot.session} snapshot={snapshot}
    navigation={router.canGoBack() ? null : { icon: 'menu', label: localizedGetter('adminDrawerSections', locale), onPress: openDrawer }} />;
}
