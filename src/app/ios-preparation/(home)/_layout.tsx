import { Stack } from 'expo-router';
import { RoleDrawerButton } from '../../../shared/navigation/RoleDrawerButton';
import { usePreparationText } from '../../../preparation/PreparationUI';
export default function PreparationHomeLayout() {
  const t = usePreparationText();
  return <Stack screenOptions={{
    headerLeft: ({ canGoBack }) => canGoBack ? null : <RoleDrawerButton label={t('Tayyorlov bo‘limlari')} />,
    headerBackVisible: true,
    headerBackButtonDisplayMode: 'minimal',
  }} />;
}
