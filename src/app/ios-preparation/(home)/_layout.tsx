import { router, Stack, type Href } from 'expo-router';
import { BaseHost } from '../../../components/BaseHost';
import { WorkerProfileButton } from '../../../components/WorkerProfileButton.ios';
import { RoleDrawerButton } from '../../../shared/navigation/RoleDrawerButton';
import { usePreparationContext } from '../../../preparation/PreparationContext';
import { usePreparationText } from '../../../preparation/PreparationUI';

function PreparationHeaderProfile() {
  const { session } = usePreparationContext();
  return <BaseHost matchContents><WorkerProfileButton key={session.imageCacheScope} session={session}
    onPress={() => router.navigate('/ios-preparation/profile' as Href)} /></BaseHost>;
}

export default function PreparationHomeLayout() {
  const t = usePreparationText();
  return <Stack screenOptions={{
    headerLeft: ({ canGoBack }) => canGoBack ? null : <RoleDrawerButton label={t('Tayyorlov bo‘limlari')} />,
    headerRight: () => <PreparationHeaderProfile />,
    headerBackVisible: true,
    headerBackButtonDisplayMode: 'minimal',
  }} />;
}
