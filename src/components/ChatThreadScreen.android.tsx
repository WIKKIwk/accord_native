import { Host, OutlinedTextField, Text as ComposeText, useMaterialColors, useNativeState } from '@expo/ui/jetpack-compose';
import { fillMaxWidth } from '@expo/ui/jetpack-compose/modifiers';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { Stack } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, KeyboardAvoidingView, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { draftAfterSending } from '../chatComposer';
import { discardChatMedia, prepareChatDocument, prepareChatMedia, type ChatMediaDraft } from '../chatMedia';
import { chatTimeline } from '../chatModel';
import type { ChatThreadProps } from '../shared/chat/chatPageTypes';
import { useChatThread } from '../useChatThread';
import { ChatMediaThumbnail, openChatMedia, SelectedChatMediaPreview } from './ChatMediaPreview';

export function ChatThreadScreen({ session, conversationId, title }: ChatThreadProps) {
  const thread = useChatThread(session, conversationId), colors = useMaterialColors(), insets = useSafeAreaInsets();
  const [draft, setDraft] = useState(''), [media, setMedia] = useState<ChatMediaDraft[]>([]), [selecting, setSelecting] = useState(false), [batchSending, setBatchSending] = useState(false);
  const input = useNativeState(''), mounted = useRef(true), sending = useRef(false), selection = useRef<ChatMediaDraft[]>([]);
  const followLatest = useRef(true), list = useRef<FlatList>(null);
  useEffect(() => { input.set(draft); }, [draft, input]);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; selection.current.forEach(discardChatMedia); }; }, []);
  const updateMedia = (next: ChatMediaDraft[]) => { selection.current = next; setMedia(next); };
  const remove = (item: ChatMediaDraft) => { updateMedia(selection.current.filter(value => value.clientMessageId !== item.clientMessageId)); discardChatMedia(item); };
  const busy = selecting || batchSending || thread.queueing || thread.mediaSending;
  const choose = async (source: 'library' | 'camera' | 'file') => {
    if (busy) return;
    setSelecting(true); thread.clearMediaError();
    try {
      const chosen: ChatMediaDraft[] = [];
      try {
        if (source === 'file') {
          const result = await DocumentPicker.getDocumentAsync({ type: ['image/*', 'video/*'], copyToCacheDirectory: true, multiple: true });
          if (!result.canceled) for (const asset of result.assets) chosen.push(await prepareChatDocument(asset));
        } else {
          if (source === 'camera' && !(await ImagePicker.requestCameraPermissionsAsync()).granted) throw new Error('Kameradan foydalanishga ruxsat bering.');
          const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images', 'videos'], quality: 1,
            allowsMultipleSelection: source === 'library', ...(source === 'camera' ? { videoMaxDuration: 600 } : {}) };
          const result = source === 'camera' ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
          if (!result.canceled) for (const asset of result.assets) chosen.push(await prepareChatMedia(asset));
        }
      } catch (error) { chosen.forEach(discardChatMedia); throw error; }
      if (mounted.current) updateMedia([...selection.current, ...chosen]);
      else chosen.forEach(discardChatMedia);
    } catch (error) { if (mounted.current) Alert.alert('Media tanlanmadi', error instanceof Error ? error.message : 'Qayta urinib ko‘ring.'); }
    finally { if (mounted.current) setSelecting(false); }
  };
  const attachments = () => Alert.alert('Biriktirish', undefined, [
    { text: 'Kamera', onPress: () => void choose('camera') }, { text: 'Rasmlar', onPress: () => void choose('library') },
    { text: 'Fayl', onPress: () => void choose('file') },
  ], { cancelable: true });
  const send = async () => {
    if (sending.current || busy || !thread.storageReady || (!draft.trim() && !media.length)) return;
    sending.current = true; setBatchSending(true); followLatest.current = true;
    const sent = draft, batch = [...selection.current];
    try {
      if (!batch.length) {
        if (await thread.send(sent) && mounted.current) setDraft(current => draftAfterSending(sent, current));
      } else for (let index = 0; index < batch.length; index++) {
        if (!(await thread.sendMedia(batch[index], index === 0 ? sent : '')) || !mounted.current) break;
        remove(batch[index]);
        if (index === 0) setDraft(current => draftAfterSending(sent, current));
      }
    } finally { sending.current = false; if (mounted.current) setBatchSending(false); }
  };
  const rows = chatTimeline(session, thread.messages ?? [], thread.pending);
  return <KeyboardAvoidingView behavior="height" style={{ flex: 1, backgroundColor: colors.surface }}>
    <Stack.Screen options={{ title: title || 'Suhbat' }} />
    <FlatList ref={list} data={rows} keyExtractor={item => item.key} keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ flexGrow: 1, padding: 12 }} maintainVisibleContentPosition={{ minIndexForVisible: 0 }}
      onScroll={event => { const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent; followLatest.current = contentSize.height - layoutMeasurement.height - contentOffset.y < 80; }}
      onContentSizeChange={() => { if (followLatest.current) list.current?.scrollToEnd({ animated: false }); }}
      refreshControl={<RefreshControl refreshing={thread.messages === null && !thread.error} onRefresh={() => void thread.refresh()} />}
      ListHeaderComponent={<View style={{ gap: 8 }}>
        {thread.hasMore && <Pressable disabled={thread.loadingMore} onPress={() => { followLatest.current = false; void thread.loadOlder(); }} style={{ padding: 12 }}><Text style={{ color: colors.primary }}>Avvalgi xabarlar</Text></Pressable>}
        {thread.loadingMore && <ActivityIndicator />}
        {!!thread.error && <Pressable onPress={() => void thread.refresh()} style={{ padding: 12 }}><Text style={{ color: colors.error }}>{thread.error}</Text><Text style={{ color: colors.primary }}>Qayta urinish</Text></Pressable>}
      </View>}
      ListEmptyComponent={thread.messages !== null && !thread.error ? <Text style={{ color: colors.onSurfaceVariant, padding: 16 }}>Hali xabarlar yo‘q</Text> : undefined}
      renderItem={({ item }) => <View style={{ alignSelf: item.mine ? 'flex-end' : 'flex-start', maxWidth: '82%', marginVertical: 5, gap: 4 }}>
        {item.attachment ? <Pressable onPress={() => void openChatMedia(session, item.attachment!)}><ChatMediaThumbnail session={session} attachment={item.attachment} /></Pressable> : undefined}
        {!!(item.attachment ? item.caption : item.body) && <View style={{ paddingHorizontal: 14, paddingVertical: 10, borderRadius: 18, backgroundColor: item.mine ? colors.primaryContainer : colors.surfaceContainerHigh }}>
          <Text selectable style={{ color: item.mine ? colors.onPrimaryContainer : colors.onSurface, fontSize: 16 }}>{item.attachment ? item.caption : item.body}</Text></View>}
        <Text style={{ color: colors.onSurfaceVariant, fontSize: 11 }}>{new Date(item.timestamp * 1000).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}{item.pending ? ' · Yuborilmoqda…' : ''}</Text>
      </View>} />
    {!!thread.sendError && <Pressable onPress={thread.retry} style={{ padding: 12 }}><Text style={{ color: colors.error }}>{thread.sendError}</Text><Text style={{ color: colors.primary }}>Qayta urinish</Text></Pressable>}
    {!!thread.mediaError && <Text style={{ color: colors.error, padding: 12 }}>{thread.mediaError}</Text>}
    {!!thread.mediaProgress && <Text style={{ color: colors.onSurfaceVariant, paddingHorizontal: 12 }}>{thread.mediaProgress}</Text>}
    {!!media.length && <ScrollView horizontal style={{ maxHeight: 124 }} contentContainerStyle={{ padding: 8, gap: 8 }}>{media.map(item => <View key={item.clientMessageId}>
      <SelectedChatMediaPreview draft={item} /><Pressable disabled={busy} accessibilityLabel="Olib tashlash" onPress={() => remove(item)}><Text style={{ color: colors.primary }}>Olib tashlash</Text></Pressable>
    </View>)}</ScrollView>}
    <View style={{ flexDirection: 'row', alignItems: 'center', padding: 8, paddingBottom: Math.max(8, insets.bottom), gap: 8 }}>
      <Pressable disabled={busy || !thread.storageReady} accessibilityRole="button" accessibilityLabel="Biriktirish" onPress={attachments} style={{ padding: 8 }}>
        <SymbolView name={{ android: 'add' }} size={26} tintColor={colors.primary} /></Pressable>
      <Host matchContents={{ vertical: true }} style={{ flex: 1 }}><OutlinedTextField value={input} onValueChange={setDraft} enabled={!busy} modifiers={[fillMaxWidth()]}>
        <OutlinedTextField.Placeholder><ComposeText>Xabar yozing</ComposeText></OutlinedTextField.Placeholder>
      </OutlinedTextField></Host>
      <Pressable disabled={busy || !thread.storageReady || (!draft.trim() && !media.length)} accessibilityRole="button" accessibilityLabel="Yuborish" onPress={() => void send()} style={{ padding: 8 }}>
        {busy ? <ActivityIndicator /> : <SymbolView name={{ android: 'send' }} size={26} tintColor={colors.primary} />}
      </Pressable>
    </View>
  </KeyboardAvoidingView>;
}
