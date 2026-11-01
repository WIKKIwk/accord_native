import { Image } from 'expo-image';
import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import { StyleSheet, useColorScheme, View } from 'react-native';
import type { Session } from '../auth';
import { chatAvatarSource, type ChatPeer } from '../chatModel';

type Props = { session: Session; peer: ChatPeer | null; token: string | null };

export function ChatAvatar({ session, peer, token }: Props) {
  const dark = useColorScheme() === 'dark';
  const source = chatAvatarSource(session, peer);
  const [failed, setFailed] = useState('');
  const requestKey = source ? `${source.cacheKey}:${source.authenticated ? token : ''}` : '';
  const showImage = source && failed !== requestKey && (!source.authenticated || token);

  return <View accessible={false} pointerEvents="none" style={[styles.avatar, { backgroundColor: dark ? '#2c2c2e' : '#e5e5ea' }]}>
    <SymbolView name="person.fill" size={22} tintColor={dark ? '#aeaeb2' : '#8e8e93'} />
    {showImage ? <Image source={{ uri: source.uri, cacheKey: source.cacheKey,
      ...(source.authenticated ? { headers: { Authorization: `Bearer ${token}` } } : {}) }}
      style={StyleSheet.absoluteFill} contentFit="cover" cachePolicy="memory" onError={() => setFailed(requestKey)} /> : null}
  </View>;
}

const styles = StyleSheet.create({
  avatar: { width: 48, height: 48, borderRadius: 24, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
});
