import { Image } from 'expo-image';
import { SymbolView } from 'expo-symbols';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import type { Session } from '../auth';
import { chatMediaTicket, type ChatMediaDraft } from '../chatMedia';
import type { ChatAttachment } from '../chatModel';

export function SelectedChatMediaPreview({ draft, onImageSettled }: { draft: ChatMediaDraft; onImageSettled?: () => void }) {
  return <View pointerEvents="none" style={[styles.selected, draft.kind === 'image' ? null : styles.selectedVideo]}>
    {draft.kind === 'image' ? <Image source={{ uri: draft.uri }} style={StyleSheet.absoluteFill} contentFit="cover"
      onLoad={() => onImageSettled?.()} onError={() => onImageSettled?.()} />
      : <SymbolView name={{ ios: 'video.fill', android: 'videocam' }} size={22} tintColor="#8e8e93" />}
  </View>;
}

export function ChatMediaThumbnail({ session, attachment }: { session: Session; attachment: ChatAttachment }) {
  const key = JSON.stringify([session.imageCacheScope, session.baseUrl, attachment.mediaId]);
  const [result, setResult] = useState<{ key: string; uri: string } | null>(null);
  const [failure, setFailure] = useState('');
  const uri = result?.key === key && failure !== key ? result.uri : '';
  useEffect(() => {
    const controller = new AbortController();
    void chatMediaTicket(session, attachment.mediaId, controller.signal).then(value => {
      if (controller.signal.aborted) return;
      const thumbnail = new URL(value);
      thumbnail.pathname = thumbnail.pathname.replace(/\/content$/, '/thumbnail');
      setResult({ key, uri: thumbnail.toString() });
    }).catch(() => { if (!controller.signal.aborted) setFailure(key); });
    return () => controller.abort();
  }, [attachment.mediaId, key, session]);
  return <View pointerEvents="none" style={styles.thumbnail}>
    {uri ? <Image source={{ uri, cacheKey: JSON.stringify(['chat-media', key]) }}
      style={StyleSheet.absoluteFill} contentFit="cover" cachePolicy="memory" onError={() => setFailure(key)} />
      : <SymbolView name={{ ios: attachment.kind === 'video' ? 'video.fill' : 'photo', android: attachment.kind === 'video' ? 'videocam' : 'photo' }} size={28} tintColor="#8e8e93" />}
    {attachment.kind === 'video' ? <View style={styles.play}><SymbolView name={{ ios: 'play.fill', android: 'play_arrow' }} size={22} tintColor="#ffffff" /></View> : null}
  </View>;
}

export async function openChatMedia(session: Session, attachment: ChatAttachment) {
  try {
    const url = await chatMediaTicket(session, attachment.mediaId);
    await WebBrowser.openBrowserAsync(url);
  } catch {
    Alert.alert('Media ochilmadi', 'Internetni tekshirib, qayta urinib ko‘ring.');
  }
}

const styles = StyleSheet.create({
  selected: { width: 96, height: 96, borderRadius: 12, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  selectedVideo: { backgroundColor: '#e5e5ea' },
  thumbnail: { width: 200, height: 150, borderRadius: 14, overflow: 'hidden', backgroundColor: '#e5e5ea', alignItems: 'center', justifyContent: 'center' },
  play: { width: 46, height: 46, borderRadius: 23, backgroundColor: '#00000099', alignItems: 'center', justifyContent: 'center' },
});
