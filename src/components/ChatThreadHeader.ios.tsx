import { GlassView } from 'expo-glass-effect';
import { Platform, StyleSheet, Text, useColorScheme, View } from 'react-native';
import { activeSessionToken, type Session } from '../auth';
import type { ChatPeer } from '../chatModel';
import { ChatAvatar } from './ChatAvatar';

export const CHAT_HEADER_CONTENT_HEIGHT = 92;

export function ChatThreadHeader({ session, peer, title, topInset }: {
  session: Session; peer: ChatPeer | null; title: string; topInset: number;
}) {
  const dark = useColorScheme() === 'dark';
  const name = title || 'Suhbat';
  const label = <Text numberOfLines={1} style={[styles.name, { color: dark ? '#ffffff' : '#000000' }]}>{name}</Text>;
  return <View pointerEvents="none" style={[styles.header, { height: topInset + CHAT_HEADER_CONTENT_HEIGHT + 20 }]}>
    <View accessible accessibilityRole="header" accessibilityLabel={name} style={[styles.identity, { top: topInset + 4 }]}>
      <ChatAvatar session={session} peer={peer} token={activeSessionToken(session)} size={56} />
      {Number(Platform.Version) >= 26
        ? <GlassView glassEffectStyle="regular" style={styles.nameContainer}>{label}</GlassView>
        : <View style={[styles.nameContainer, { backgroundColor: dark ? '#303033' : '#e5e5ea' }]}>{label}</View>}
    </View>
  </View>;
}

const styles = StyleSheet.create({
  header: { position: 'absolute', top: 0, left: 0, right: 0 },
  identity: { position: 'absolute', alignSelf: 'center', alignItems: 'center', maxWidth: '60%' },
  nameContainer: { marginTop: 3, borderRadius: 16, overflow: 'hidden', maxWidth: '100%' },
  name: { fontSize: 16, fontWeight: '600', textAlign: 'center', paddingHorizontal: 9, paddingVertical: 3 },
});
