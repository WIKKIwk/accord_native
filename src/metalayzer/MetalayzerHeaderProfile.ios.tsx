import { router, type Href } from 'expo-router';
import { BaseHost } from '../components/BaseHost';
import { WorkerProfileButton } from '../components/WorkerProfileButton.ios';
import { useMetalayzerContext } from './MetalayzerContext';

export function MetalayzerHeaderProfile() {
  const { session, isCurrent } = useMetalayzerContext();
  return <BaseHost matchContents><WorkerProfileButton key={session.imageCacheScope} session={session}
    onPress={() => { if (isCurrent()) router.navigate('/ios-metalayzer/profile' as Href); }} /></BaseHost>;
}
