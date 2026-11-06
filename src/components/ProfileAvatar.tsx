import { Image } from 'expo-image';
import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import { StyleSheet, useColorScheme, View } from 'react-native';
import type { Session } from '../auth';
import { profileAvatarSource } from '../profileModel';

type Props = { session: Session; profile: Record<string, unknown>; token: string | null; size?: number; revision?: number; previewUri?: string | null; cachedUri?: string | null };

export function ProfileAvatar({ session, profile, token, size = 72, revision = 0, previewUri, cachedUri }: Props) {
  const dark = useColorScheme() === 'dark';
  const source = profileAvatarSource(session, profile);
  const localUri = previewUri || cachedUri;
  const cacheKey = localUri ? `profile-preview:${localUri}` : source ? `${source.cacheKey}:${revision}` : '';
  const [failure, setFailure] = useState<{ key: string; token: string } | null>(null);
  const imageToken = localUri ? '' : token;
  const imageSource = localUri ? { uri: localUri, cacheKey } : source && token
    ? { ...source, cacheKey, headers: { Authorization: `Bearer ${token}` } } : null;
  const showImage = imageSource && !(failure?.key === cacheKey && failure.token === imageToken);

  return <View pointerEvents="none" accessible accessibilityRole="image" accessibilityLabel="Profil rasmi"
    style={[styles.avatar, { width: size, height: size, borderRadius: size / 2, backgroundColor: dark ? '#2c2c2e' : '#e5e5ea' }]}>
    <SymbolView name={{ ios: 'person.fill', android: 'person', web: 'person' }} size={Math.round(size * 0.44)}
      tintColor={dark ? '#aeaeb2' : '#8e8e93'} />
    {showImage ? <Image source={imageSource}
      style={StyleSheet.absoluteFill} contentFit="cover" cachePolicy="memory"
      onError={() => setFailure({ key: cacheKey, token: imageToken ?? '' })} /> : null}
  </View>;
}

const styles = StyleSheet.create({
  avatar: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
});
