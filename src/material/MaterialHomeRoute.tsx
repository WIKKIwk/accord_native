import { router, useFocusEffect, type Href } from 'expo-router';
import { useCallback, useState } from 'react';
import { Platform } from 'react-native';
import { useMaterialContext } from './MaterialContext';
import { MaterialHome } from './MaterialHome';

/** Each focus owns its callbacks; a callback from a previous focus cannot revive. */
export function MaterialHomeRoute() {
  const { session } = useMaterialContext();
  const [lifetime, setLifetime] = useState<{ current: boolean; session: typeof session } | null>(null);
  useFocusEffect(useCallback(() => {
    const focus = { current: true, session };
    setLifetime(focus);
    return () => { focus.current = false; };
  }, [session]));
  return <MaterialHome handlers={{ isCurrent: () => lifetime?.current === true && lifetime.session === session,
    tasks: () => router.navigate(`/${Platform.OS === 'ios' ? 'ios' : 'android'}-material/tasks` as Href) }} />;
}
