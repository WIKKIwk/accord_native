import { HStack, RNHostView } from '@expo/ui/swift-ui';
import { frame } from '@expo/ui/swift-ui/modifiers';
import { useFocusEffect } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useCallback, useState } from 'react';
import { PlatformColor } from 'react-native';
import { activeSessionToken, type Session } from '../auth';
import { authorizedFetch } from '../authorizedFetch';
import { profileAvatarSource, profileSnapshotFromResponse } from '../profileModel';
import { ProfileAvatar } from './ProfileAvatar';
import { ProfilePressTarget } from './ProfilePressTarget.ios';

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
  // Keep the toolbar content square; a SwiftUI Button here would compete with the hold responder.
  return <HStack modifiers={[frame({ width: 44, height: 44 })]}>
    <RNHostView matchContents>
      <ProfilePressTarget onPress={onPress}>
        {hasAvatar
          ? <ProfileAvatar session={session} profile={avatar.profile} token={avatar.token} size={32} />
          : <SymbolView name={{ ios: 'person.crop.circle' }} size={24} tintColor={PlatformColor('label')} />}
      </ProfilePressTarget>
    </RNHostView>
  </HStack>;
}
