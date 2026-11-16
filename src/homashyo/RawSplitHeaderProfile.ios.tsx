import { router, type Href } from 'expo-router';
import { BaseHost } from '../components/BaseHost';
import { WorkerProfileButton } from '../components/WorkerProfileButton.ios';
import { useRawSplitContext } from './RawSplitContext';

export function RawSplitHeaderProfile() {
  const { session } = useRawSplitContext();
  return <BaseHost matchContents><WorkerProfileButton key={session.imageCacheScope} session={session}
    onPress={() => router.navigate('/ios-homashyo/profile' as Href)} /></BaseHost>;
}
