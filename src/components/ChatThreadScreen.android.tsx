import { CircularProgressIndicator, FilledIconButton, Host, Icon, IconButton, OutlinedTextField, Row, Shape, Text as ComposeText, useMaterialColors, useNativeState } from '@expo/ui/jetpack-compose';
import { background, fillMaxWidth, padding, paddingAll, semantics, size, testID, weight } from '@expo/ui/jetpack-compose/modifiers';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { Stack } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
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
  const messageLayout = useRef({ contentHeight: 0, viewportHeight: 0 }), userScrolling = useRef(false);
  const scrollFrame = useRef<number | null>(null);
  const scrollToLatest = () => {
    if (!followLatest.current || userScrolling.current || messageLayout.current.viewportHeight <= 0) return;
    if (scrollFrame.current !== null) cancelAnimationFrame(scrollFrame.current);
    scrollFrame.current = requestAnimationFrame(() => {
      scrollFrame.current = null;
      if (followLatest.current && !userScrolling.current) {
        // Let native finish layout, then use its actual maximum scroll range.
        list.current?.getScrollResponder()?.scrollToEnd({ animated: false });
      }
    });
  };
  const rememberScrollPosition = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    followLatest.current = contentSize.height - layoutMeasurement.height - contentOffset.y < 80;
  };
  useEffect(() => { input.set(draft); }, [draft, input]);
  useEffect(() => { mounted.current = true; return () => {
    mounted.current = false;
    if (scrollFrame.current !== null) cancelAnimationFrame(scrollFrame.current);
    selection.current.forEach(discardChatMedia);
  }; }, []);
  const updateMedia = (next: ChatMediaDraft[]) => { selection.current = next; setMedia(next); };
  const remove = (item: ChatMediaDraft) => { updateMedia(selection.current.filter(value => value.clientMessageId !== item.clientMessageId)); discardChatMedia(item); };
  const busy = selecting || batchSending || thread.queueing || thread.mediaSending;
  const canSend = !busy && thread.storageReady && (!!draft.trim() || !!media.length);
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
    sending.current = true; setBatchSending(true); followLatest.current = true; userScrolling.current = false;
    scrollToLatest();
    const sent = draft, batch = [...selection.current];
    try {
      if (!batch.length) {
        if (await thread.send(sent) && mounted.current) setDraft(current => draftAfterSending(sent, current));
      } else for (let index = 0; index < batch.length; index++) {
        if (!(await thread.sendMedia(batch[index], index === 0 ? sent : '')) || !mounted.current) break;
        remove(batch[index]);
        if (index === 0) setDraft(current => draftAfterSending(sent, current));
      }
    } finally { sending.current = false; if (mounted.current) { setBatchSending(false); scrollToLatest(); } }
  };
  const rows = chatTimeline(session, thread.messages ?? [], thread.pending);
  return <View testID="chat-thread" style={[styles.root, { backgroundColor: colors.surfaceContainerLow }]}>
    <Stack.Screen options={{ title: title || 'Suhbat' }} />
    <FlatList ref={list} style={styles.messages} data={rows} keyExtractor={item => item.key} keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ flexGrow: 1, padding: 12 }} maintainVisibleContentPosition={{ minIndexForVisible: 0 }}
      onScrollBeginDrag={event => { userScrolling.current = true; rememberScrollPosition(event); }}
      onScroll={event => { if (userScrolling.current) rememberScrollPosition(event); }}
      onScrollEndDrag={event => { rememberScrollPosition(event); userScrolling.current = false; }}
      onMomentumScrollBegin={() => { userScrolling.current = true; }}
      onMomentumScrollEnd={event => { rememberScrollPosition(event); userScrolling.current = false; }}
      onContentSizeChange={(_, height) => { messageLayout.current.contentHeight = height; scrollToLatest(); }}
      onLayout={event => { messageLayout.current.viewportHeight = event.nativeEvent.layout.height; scrollToLatest(); }}
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
    <Host matchContents={{ vertical: true }} style={styles.composer}>
      <Row verticalAlignment="bottom" horizontalArrangement={{ spacedBy: 4 }} modifiers={[
        fillMaxWidth(), background(colors.surfaceContainerLow), padding(4, 8, 4, Math.max(8, insets.bottom)), testID('chat-composer'),
      ]}>
        <IconButton enabled={!busy && thread.storageReady} onClick={attachments}
          colors={{ contentColor: colors.onSurfaceVariant, disabledContentColor: colors.onSurfaceVariant }}
          modifiers={[size(56, 56), paddingAll(4), semantics({ contentDescription: 'Biriktirish' }), testID('chat-attach')]}>
          <Icon source={require('../../assets/icons/fab-add.xml')} tint={colors.onSurfaceVariant} size={24} />
        </IconButton>
        <OutlinedTextField value={input} onValueChange={setDraft} minLines={1} maxLines={4}
          shape={Shape.RoundedCorner({ cornerRadii: { topStart: 28, topEnd: 28, bottomStart: 28, bottomEnd: 28 } })}
          colors={{ focusedContainerColor: colors.surface, unfocusedContainerColor: colors.surface,
            focusedTextColor: colors.onSurface, unfocusedTextColor: colors.onSurface, disabledTextColor: colors.onSurface,
            focusedPlaceholderColor: colors.onSurfaceVariant, unfocusedPlaceholderColor: colors.onSurfaceVariant, cursorColor: colors.primary }}
          textStyle={{ textAlign: 'left', fontSize: 16, color: colors.onSurface }}
          modifiers={[weight(1), semantics({ contentDescription: 'Xabar yozing' }), testID('chat-message-input')]}>
          <OutlinedTextField.Placeholder><ComposeText color={colors.onSurfaceVariant}>Xabar yozing</ComposeText></OutlinedTextField.Placeholder>
        </OutlinedTextField>
        {/* Use Material's default circle: Shape.Circle({}) has a zero native radius. */}
        <FilledIconButton enabled={canSend} onClick={() => void send()}
          colors={{ containerColor: colors.primary, contentColor: colors.onPrimary,
            disabledContainerColor: colors.surfaceContainerHighest, disabledContentColor: colors.onSurfaceVariant }}
          modifiers={[size(56, 56), paddingAll(4), semantics({ contentDescription: 'Yuborish' }), testID('chat-send')]}>
          {busy ? <CircularProgressIndicator color={colors.onSurfaceVariant} modifiers={[size(24, 24)]} />
            : <Icon source={require('../../assets/icons/chat-send.xml')} tint={canSend ? colors.onPrimary : colors.onSurfaceVariant} size={24} />}
        </FilledIconButton>
      </Row>
    </Host>
  </View>;
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  messages: { flex: 1, minHeight: 0 },
  composer: { width: '100%', flexShrink: 0 },
});
