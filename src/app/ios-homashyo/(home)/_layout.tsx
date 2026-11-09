import { Stack } from 'expo-router';
import { RoleDrawerButton } from '../../../shared/navigation/RoleDrawerButton';
import { usePreparationText } from '../../../preparation/PreparationUI';
export default function HomeLayout() {
  const t = usePreparationText();
  return <Stack screenOptions={{ headerLeft: ({ canGoBack }) => canGoBack ? null : <RoleDrawerButton label={t('Bo‘limlar')} />,
    headerBackVisible: true, headerBackButtonDisplayMode: 'minimal' }} />;
}
