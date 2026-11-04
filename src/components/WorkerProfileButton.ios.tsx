import { Button, HStack, Image, RNHostView } from '@expo/ui/swift-ui';
import { accessibilityLabel, frame } from '@expo/ui/swift-ui/modifiers';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { activeSessionToken, type Session } from '../auth';
import { authorizedFetch } from '../authorizedFetch';
import { profileAvatarSource, profileSnapshotFromResponse } from '../profileModel';
import { ProfileAvatar } from './ProfileAvatar';

type Props = { session: Session; onPress?: () => void };

export function WorkerProfileButton({ session, onPress }: Props) {
  const [avatar, setAvatar] = useState(() => ({ profile: session.profile, token: activeSessionToken(session) }));

  useFocusEffect(useCallback(() => {
    const controller = new AbortController();
    let active = true;
    void (async () => {
      try {
        const response = await authorizedFetch(session, '/v1/mobile/profile', { signal: controller.signal });
        if (!response.ok) return;
        const snapshot = profileSnapshotFromResponse(session, await response.json());
        const token = activeSessionToken(session);
        if (active && token && snapshot) setAvatar({ profile: snapshot.profile, token });
      } catch {
        // Keep the last known photo when the profile cannot be refreshed.
      }
    })();
    return () => { active = false; controller.abort(); };
  }, [session]));

  const hasAvatar = !!avatar.token && !!profileAvatarSource(session, avatar.profile);
  // A 24-point label keeps the toolbar glass circular around the 32-point avatar.
  return <Button onPress={onPress} modifiers={[accessibilityLabel('Profil')]}>
    {hasAvatar
      ? <HStack modifiers={[frame({ width: 24, height: 24 })]}>
        <RNHostView matchContents><ProfileAvatar session={session} profile={avatar.profile} token={avatar.token} size={32} /></RNHostView>
      </HStack>
      : <Image systemName="person.crop.circle" size={24} />}
  </Button>;
}
