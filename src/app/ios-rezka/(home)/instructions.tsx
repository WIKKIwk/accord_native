import { router } from 'expo-router';
import { localizedGetter } from '../../../shared/localization';
import { RezkaWorkInstructionsScreen } from '../../../rezka/RezkaWorkInstructions';
import { useRezkaShellContext } from '../../../rezka/RezkaShellContext';
import { useRezkaLocale } from '../../../rezka/useRezkaShell';

export default function IosRezkaInstructions() {
  const { snapshot, openDrawer } = useRezkaShellContext(), locale = useRezkaLocale();
  return <RezkaWorkInstructionsScreen snapshot={snapshot}
    navigation={router.canGoBack() ? null : { icon: 'menu', label: localizedGetter('adminDrawerSections', locale), onPress: openDrawer }} />;
}
