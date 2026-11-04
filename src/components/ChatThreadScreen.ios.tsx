import { Button, Host, HStack, Image, Popover, ProgressView, RNHostView, ScrollView, Spacer, Text, TextField, type TextFieldRef, useNativeState, VStack, withAnimation, ZStack } from '@expo/ui/swift-ui';
import { accessibilityLabel, animation, Animation, background, blur, buttonStyle, contentShape, defaultScrollAnchor, defaultScrollAnchorForRole, disabled, fixedSize, font, foregroundStyle, frame, glassEffect, id, layoutPriority, lineLimit, offset, onAppear, onGeometryChange, onTapGesture, opacity, padding, scrollClipDisabled, scrollDismissesKeyboard, scrollEdgeEffectStyle, scrollPosition, scrollTargetLayout, shapes, strokeBorder } from '@expo/ui/swift-ui/modifiers';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { Stack } from 'expo-router';
import { useCallback, useEffect, useRef, useState, type ComponentRef, type RefObject } from 'react';
import { Alert, Platform, StyleSheet, useColorScheme, useWindowDimensions, View } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN, scheduleOnUI } from 'react-native-worklets';
import type { Session } from '../auth';
import { draftAfterSending } from '../chatComposer';
import { discardChatMedia, prepareChatDocument, prepareChatMedia, type ChatMediaDraft } from '../chatMedia';
import { chatTimeline, outgoingMessageKey, type ChatAttachment, type ChatMessage, type ChatPeer } from '../chatModel';
import type { PendingChatText } from '../chatOutbox';
import { prepareRecentChatPhoto, type RecentChatPhoto } from '../chatRecentPhotos';
import { useChatThread } from '../useChatThread';
import { CHAT_HEADER_CONTENT_HEIGHT, ChatThreadHeader } from './ChatThreadHeader.ios';
import { ChatMediaThumbnail, openChatMedia, SelectedChatMediaPreview } from './ChatMediaPreview.ios';
import { RecentChatPhotoStrip, RecentChatPhotosButton, type RecentPhotoStrip } from './RecentChatPhotos.ios';

type Props = { session: Session; conversationId: string; title: string; peer: ChatPeer | null };
const secondary = foregroundStyle({ type: 'hierarchical', style: 'secondary' });

function timeLabel(timestamp: number): string {
  const date = new Date(timestamp * 1000);
  return timestamp > 0 && !Number.isNaN(date.getTime()) ? date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }) : '';
}

function MessageBubble({ session, body, attachment, caption, timestamp, mine, status, messageKey, animate, reduceMotion }: {
  session: Session; body: string; attachment?: ChatAttachment; caption?: string; timestamp: number; mine: boolean; status?: string; messageKey: string; animate: boolean;
  reduceMotion: boolean;
}) {
  const dark = useColorScheme() === 'dark';
  const { width } = useWindowDimensions();
  const [shown, setShown] = useState(!animate || reduceMotion);
  const [appeared, setAppeared] = useState(false);
  const [showMedia, setShowMedia] = useState(false);
  return <HStack spacing={0} modifiers={[
    id(messageKey), frame({ maxWidth: Infinity, alignment: mine ? 'trailing' : 'leading' }),
    ...(animate && !reduceMotion ? [offset({ y: shown ? 0 : 16 }), opacity(shown ? 1 : 0),
      animation(Animation.spring({ response: 0.35, dampingFraction: 0.86 }), shown)] : []),
    onAppear(() => {
      if (attachment && !showMedia) setShowMedia(true);
      if (!animate || appeared) return;
      setAppeared(true);
      setShown(true);
    }),
  ]}>
    {mine ? <Spacer /> : null}
    <VStack alignment={mine ? 'trailing' : 'leading'} spacing={4} modifiers={[frame({ maxWidth: width * 0.76, alignment: mine ? 'trailing' : 'leading' })]}>
      {attachment ? <>
        <Button onPress={() => { void openChatMedia(session, attachment); }} modifiers={[buttonStyle('plain'), accessibilityLabel(attachment.kind === 'video' ? 'Videoni ochish' : 'Rasmni ochish')]}>
          <RNHostView matchContents><View style={styles.mediaPlaceholder}>
            {showMedia ? <ChatMediaThumbnail session={session} attachment={attachment} /> : null}
          </View></RNHostView>
        </Button>
        {caption ? <Text modifiers={[font({ textStyle: 'body' }), foregroundStyle(mine ? '#ffffff' : dark ? '#ffffff' : '#000000'),
          padding({ horizontal: 14, vertical: 10 }), background(mine ? '#007AFF' : dark ? '#2c2c2e' : '#e9e9eb', shapes.roundedRectangle({ cornerRadius: 18 }))]}>{caption}</Text> : null}
      </> : <Text modifiers={[
        font({ textStyle: 'body' }), foregroundStyle(mine ? '#ffffff' : dark ? '#ffffff' : '#000000'),
        padding({ horizontal: 14, vertical: 10 }), background(mine ? '#007AFF' : dark ? '#2c2c2e' : '#e9e9eb', shapes.roundedRectangle({ cornerRadius: 18 })),
      ]}>{body}</Text>}
      <Text modifiers={[font({ textStyle: 'caption2' }), secondary]}>{[timeLabel(timestamp), status].filter(Boolean).join(' · ')}</Text>
    </VStack>
    {!mine ? <Spacer /> : null}
  </HStack>;
}

function ConversationBody({ session, messages, pending, hasMore, loadingMore, error, sendError, sending, lastQueuedId, reduceMotion, headerBottom, blurFallback, onRefresh, onLoadOlder, onRetry, onDismissKeyboard }: {
  session: Session; messages: ChatMessage[] | null; pending: PendingChatText[]; hasMore: boolean; loadingMore: boolean;
  error: string; sendError: string; sending: boolean; lastQueuedId: string | null; reduceMotion: boolean; headerBottom: number; blurFallback: boolean;
  onRefresh: () => Promise<void>; onLoadOlder: () => Promise<void>; onRetry: () => void; onDismissKeyboard: () => void;
}) {
  const rows = chatTimeline(session, messages ?? [], pending);
  const [scrollTop, setScrollTop] = useState<number | null>(null);
  const measureScroll = useCallback(({ y }: { y: number }) => {
    setScrollTop(current => current !== null && Math.abs(current - y) < 0.5 ? current : y);
  }, []);
  const position = useNativeState<string | null>(null);
  const newKey = lastQueuedId ? outgoingMessageKey(lastQueuedId) : null;
  useEffect(() => {
    if (!newKey) return;
    const frameId = requestAnimationFrame(() => {
      withAnimation(reduceMotion ? null : Animation.easeOut({ duration: 0.25 }), () => {
        'worklet';
        position.value = newKey;
      });
    });
    return () => cancelAnimationFrame(frameId);
  }, [newKey, position, reduceMotion]);
  const scrollAnchor = Number(Platform.Version) >= 18
    ? [defaultScrollAnchorForRole('bottom', 'initialOffset'), defaultScrollAnchorForRole('bottom', 'alignment')]
    : [defaultScrollAnchor('bottom')];
  return <ScrollView modifiers={[
    frame({ maxWidth: Infinity, maxHeight: Infinity }), ...scrollAnchor, scrollPosition(position, { anchor: 'bottom' }),
    scrollDismissesKeyboard('interactively'), scrollClipDisabled(), scrollEdgeEffectStyle('soft', 'top'),
    onTapGesture(onDismissKeyboard), onGeometryChange(measureScroll), ...(blurFallback ? [blur(8)] : []),
  ]}>
    <VStack alignment="leading" spacing={12} modifiers={[
      scrollTargetLayout(), frame({ maxWidth: Infinity }),
      padding({ horizontal: 16, top: Math.max(14, headerBottom - (scrollTop ?? 0) + 8), bottom: 14 }),
    ]}>
      {hasMore ? <HStack><Spacer /><Button label={loadingMore ? 'Yuklanmoqda…' : 'Avvalgi xabarlar'} onPress={() => { void onLoadOlder(); }}
        modifiers={[buttonStyle('bordered'), disabled(loadingMore)]} /><Spacer /></HStack> : null}
      {messages === null && !error ? <HStack spacing={10}><ProgressView /><Text modifiers={[secondary]}>Xabarlar yuklanmoqda…</Text></HStack> : null}
      {error ? <VStack alignment="leading" spacing={8}>
        <Text modifiers={[secondary]}>{error}</Text><Button label="Qayta urinish" onPress={() => { void onRefresh(); }} modifiers={[buttonStyle('bordered')]} />
      </VStack> : null}
      {messages !== null && !rows.length ? <HStack><Spacer /><Text modifiers={[secondary, padding({ vertical: 20 })]}>Hali xabarlar yo‘q.</Text><Spacer /></HStack> : null}
      {rows.map(row => <MessageBubble key={row.key} session={session} messageKey={row.key} body={row.body} attachment={row.attachment} caption={row.caption} timestamp={row.timestamp} mine={row.mine}
        status={row.pending ? sendError ? 'Yuborilmadi' : sending ? 'Yuborilmoqda…' : 'Kutilmoqda' : undefined}
        animate={row.key === newKey} reduceMotion={reduceMotion} />)}
      {sendError ? <HStack><Spacer /><VStack alignment="trailing" spacing={6}>
        <Text modifiers={[font({ textStyle: 'footnote' }), secondary]}>{sendError}</Text>
        <Button label="Qayta urinish" onPress={onRetry} modifiers={[buttonStyle('bordered')]} />
      </VStack></HStack> : null}
    </VStack>
  </ScrollView>;
}

function Composer({ ready, queueing, mediaSending, mediaProgress, mediaError, clearMediaError, onSend, onSendMedia, inputRef, rootRef, onStripChange }: {
  ready: boolean; queueing: boolean; mediaSending: boolean; mediaProgress: string; mediaError: string; clearMediaError: () => void;
  onSend: (body: string) => Promise<boolean>; onSendMedia: (media: ChatMediaDraft, caption: string) => Promise<boolean>; inputRef: RefObject<TextFieldRef | null>;
  rootRef: RefObject<ComponentRef<typeof View> | null>; onStripChange: (strip: RecentPhotoStrip | null) => void;
}) {
  const dark = useColorScheme() === 'dark';
  const [draft, setDraft] = useState('');
  const [media, setMedia] = useState<ChatMediaDraft[]>([]);
  const [selecting, setSelecting] = useState(false);
  const [batchSending, setBatchSending] = useState(false);
  const [mediaMenuOpen, setMediaMenuOpen] = useState(false);
  const selected = useRef<ChatMediaDraft[]>([]);
  const batchInProgress = useRef(false);
  const consumedCaption = useRef<string | null>(null);
  const menuDismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const value = useNativeState('');
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => {
    mounted.current = false;
    if (menuDismissTimer.current !== null) clearTimeout(menuDismissTimer.current);
    selected.current.forEach(discardChatMedia);
  }; }, []);
  const busyMedia = mediaSending || batchSending;
  const canSend = ready && !queueing && !busyMedia && !selecting && (!!draft.trim() || media.length > 0);
  const surface = Number(Platform.Version) >= 26
    ? [glassEffect({ glass: { variant: 'regular' }, shape: 'roundedRectangle', cornerRadius: 23 })]
    : [
        background({ type: 'material', material: 'regular' }, shapes.roundedRectangle({ cornerRadius: 23 })),
        strokeBorder({ shape: 'roundedRectangle', cornerRadius: 23, content: dark ? '#545456' : '#c7c7cc', style: { lineWidth: 1 } }),
      ];
  const clearSentText = (sent: string) => {
    scheduleOnUI(() => {
      'worklet';
      const current = value.value;
      const next = draftAfterSending(sent, current);
      if (next !== current) {
        value.value = next;
        scheduleOnRN(setDraft, next);
      }
    });
  };
  const removeMedia = (item: ChatMediaDraft) => {
    selected.current = selected.current.filter(value => value.clientMessageId !== item.clientMessageId);
    setMedia(selected.current);
    discardChatMedia(item);
  };
  const send = async () => {
    if (!canSend || batchInProgress.current) return;
    const sent = value.get();
    const caption = consumedCaption.current === sent ? '' : sent;
    if (!caption.trim() && !media.length) return;
    if (!media.length) {
      if (await onSend(caption) && mounted.current) clearSentText(sent);
      return;
    }
    batchInProgress.current = true;
    setBatchSending(true);
    try {
      for (let index = 0; index < media.length; index++) {
        const item = media[index];
        if (!(await onSendMedia(item, index === 0 ? caption : '')) || !mounted.current) break;
        removeMedia(item);
        if (index === 0) {
          if (caption) consumedCaption.current = sent;
          clearSentText(sent);
        }
      }
    } finally {
      batchInProgress.current = false;
      if (mounted.current) setBatchSending(false);
    }
  };
  const acceptMedia = (next: ChatMediaDraft) => {
    if (!mounted.current) { discardChatMedia(next); return; }
    selected.current = [...selected.current, next];
    setMedia(selected.current);
  };
  const chooseMedia = async (source: 'camera' | 'library' | 'file') => {
    try {
      let next: ChatMediaDraft;
      if (source === 'file') {
        const result = await DocumentPicker.getDocumentAsync({ type: ['image/*', 'video/*'], copyToCacheDirectory: true, multiple: false });
        if (result.canceled || !result.assets[0]) return;
        next = await prepareChatDocument(result.assets[0]);
      } else {
        if (source === 'camera') {
          const permission = await ImagePicker.requestCameraPermissionsAsync();
          if (!permission.granted) throw new Error('Kameradan foydalanishga ruxsat bering.');
        }
        const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images', 'videos'], allowsMultipleSelection: false,
          quality: 1, preferredAssetRepresentationMode: ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
          ...(source === 'camera' ? { videoMaxDuration: 600 } : {}) };
        const result = source === 'camera' ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
        if (result.canceled || !result.assets[0]) return;
        next = await prepareChatMedia(result.assets[0]);
      }
      acceptMedia(next);
    } catch (reason) {
      if (mounted.current) Alert.alert('Media tanlanmadi', reason instanceof Error ? reason.message : 'Qayta urinib ko‘ring.');
    } finally { if (mounted.current) setSelecting(false); }
  };
  const selectRecentPhoto = async (photo: RecentChatPhoto) => {
    if (!ready || selecting || busyMedia) return;
    setSelecting(true);
    clearMediaError();
    try { acceptMedia(await prepareRecentChatPhoto(photo)); }
    catch (reason) { if (mounted.current) Alert.alert('Rasm tanlanmadi', reason instanceof Error ? reason.message : 'Qayta urinib ko‘ring.'); }
    finally { if (mounted.current) setSelecting(false); }
  };
  const selectSource = (source: 'camera' | 'library' | 'file') => {
    if (!ready || selecting || busyMedia || menuDismissTimer.current !== null) return;
    setSelecting(true);
    clearMediaError();
    setMediaMenuOpen(false);
    // Let the native popover finish dismissing before presenting another picker.
    menuDismissTimer.current = setTimeout(() => {
      menuDismissTimer.current = null;
      if (mounted.current) void chooseMedia(source);
    }, 400);
  };
  return <VStack alignment="leading" spacing={0} modifiers={[
    padding({ leading: 3, trailing: 3, vertical: 3 }), frame({ minHeight: 46, maxWidth: Infinity }),
    ...surface, padding({ horizontal: 12, top: 8, bottom: 8 }), layoutPriority(1),
  ]}>
    {media.length ? <VStack alignment="leading" spacing={4} modifiers={[frame({ maxWidth: Infinity, alignment: 'leading' })]}>
      <ScrollView axes="horizontal" showsIndicators={false} modifiers={[frame({ maxWidth: Infinity, minHeight: 108, maxHeight: 108 })]}>
        <HStack spacing={8} modifiers={[padding({ horizontal: 8, top: 8, bottom: 4 })]}>
          {media.map(item => <ZStack key={item.clientMessageId} alignment="topTrailing">
            <RNHostView matchContents><SelectedChatMediaPreview draft={item} /></RNHostView>
            {!busyMedia ? <Button onPress={() => { removeMedia(item); clearMediaError(); }} modifiers={[
              buttonStyle('plain'), accessibilityLabel('Media faylni olib tashlash'), disabled(selecting), padding({ top: 4, trailing: 4 }),
            ]}>
              <Image systemName="xmark" size={11} color="#ffffff" modifiers={[frame({ width: 24, height: 24 }), background('#000000aa', shapes.circle())]} />
            </Button> : null}
          </ZStack>)}
        </HStack>
      </ScrollView>
      {busyMedia || mediaError ? <VStack alignment="leading" spacing={6} modifiers={[padding({ horizontal: 8, bottom: 4 })]}>
        {busyMedia ? <HStack spacing={6}><ProgressView /><Text modifiers={[font({ textStyle: 'caption' }), secondary]}>{mediaProgress || 'Yuborilmoqda…'}</Text></HStack> : null}
        {mediaError ? <Text modifiers={[font({ textStyle: 'caption' }), foregroundStyle('#ff453a'), lineLimit(2)]}>{mediaError}</Text> : null}
      </VStack> : null}
    </VStack> : null}
  <HStack alignment="bottom" spacing={4} modifiers={[frame({ minHeight: 40, maxWidth: Infinity })]}>
    <Popover isPresented={mediaMenuOpen} onIsPresentedChange={setMediaMenuOpen} attachmentAnchor="top" arrowEdge="bottom">
      <Popover.Trigger>
        <RNHostView matchContents><RecentChatPhotosButton enabled={ready && !selecting && !busyMedia} rootRef={rootRef}
          onTap={() => setMediaMenuOpen(true)} onSelect={photo => { void selectRecentPhoto(photo); }} onStripChange={onStripChange} /></RNHostView>
      </Popover.Trigger>
      <Popover.Content>
        <VStack alignment="leading" spacing={0} modifiers={[padding({ all: 8 })]}>
          {([{ source: 'camera', label: 'Kamera', icon: 'camera' }, { source: 'library', label: 'Rasmlar', icon: 'photo' },
            { source: 'file', label: 'Fayllar', icon: 'paperclip' }] as const).map(item =>
            <Button key={item.source} onPress={() => selectSource(item.source)} modifiers={[buttonStyle('plain'), accessibilityLabel(item.label)]}>
              <HStack spacing={12} modifiers={[padding({ horizontal: 8 }), frame({ width: 220, height: 52, alignment: 'leading' }), contentShape(shapes.rectangle())]}>
                <Image systemName={item.icon} size={18} color={dark ? '#ffffff' : '#1c1c1e'} modifiers={[
                  frame({ width: 36, height: 36 }), background(dark ? '#38383b' : '#e5e5ea', shapes.circle()),
                ]} />
                <Text modifiers={[font({ textStyle: 'body' })]}>{item.label}</Text><Spacer />
              </HStack>
            </Button>)}
        </VStack>
      </Popover.Content>
    </Popover>
    <TextField ref={inputRef} text={value} onTextChange={text => {
      if (consumedCaption.current !== null && text !== consumedCaption.current) consumedCaption.current = null;
      setDraft(text);
    }} placeholder="Xabar yozing" axis="vertical" maxLength={4000} modifiers={[
      font({ textStyle: 'body' }), lineLimit({ min: 1, max: 4 }), fixedSize({ horizontal: false, vertical: true }),
      padding({ vertical: 8 }), frame({ maxWidth: Infinity, minHeight: 40, alignment: 'leading' }),
      accessibilityLabel('Xabar matni'), disabled(!ready),
    ]} />
    <Button onPress={() => { void send(); }} modifiers={[buttonStyle('plain'), accessibilityLabel('Xabarni yuborish'), disabled(!canSend)]}>
      <Image systemName="arrow.up" color="#ffffff" modifiers={[
        font({ size: 18, weight: 'semibold' }), frame({ width: 30, height: 30 }),
        background(canSend ? '#007AFF' : dark ? '#8e8e93' : '#6c6c70', shapes.circle()),
        frame({ width: 40, height: 40 }),
      ]} />
    </Button>
  </HStack></VStack>;
}

export function ChatThreadScreen({ session, conversationId, title, peer }: Props) {
  const thread = useChatThread(session, conversationId);
  const dark = useColorScheme() === 'dark';
  const reduceMotion = useReducedMotion();
  const inputRef = useRef<TextFieldRef>(null);
  const rootRef = useRef<ComponentRef<typeof View>>(null);
  const [recentStrip, setRecentStrip] = useState<RecentPhotoStrip | null>(null);
  const [backdropFailed, setBackdropFailed] = useState(false);
  const changeRecentStrip = useCallback((strip: RecentPhotoStrip | null) => {
    if (!strip) setBackdropFailed(false);
    setRecentStrip(strip);
  }, []);
  const insets = useSafeAreaInsets();
  return <>
    <Stack.Screen options={{ title: title || 'Suhbat', headerTitle: '', headerBackButtonDisplayMode: 'minimal',
      headerTransparent: true, headerShadowVisible: false, scrollEdgeEffects: { top: 'soft' } }} />
    <View ref={rootRef} collapsable={false} style={[styles.root, { backgroundColor: dark ? '#000000' : '#ffffff' }]}>
    <Host style={styles.root}>
      <VStack spacing={0} modifiers={[frame({ maxWidth: Infinity, maxHeight: Infinity })]}>
        <ConversationBody session={session} messages={thread.messages} pending={thread.pending} hasMore={thread.hasMore}
          loadingMore={thread.loadingMore} error={thread.error} sendError={thread.sendError} sending={thread.sending}
          lastQueuedId={thread.lastQueuedId} reduceMotion={reduceMotion} headerBottom={insets.top + CHAT_HEADER_CONTENT_HEIGHT}
          blurFallback={!!recentStrip && (!recentStrip.backdrop || backdropFailed)}
          onRefresh={thread.refresh} onLoadOlder={thread.loadOlder} onRetry={thread.retry} onDismissKeyboard={() => { void inputRef.current?.blur(); }} />
        <Composer ready={thread.storageReady} queueing={thread.queueing} onSend={thread.send} inputRef={inputRef}
          mediaSending={thread.mediaSending} mediaProgress={thread.mediaProgress} mediaError={thread.mediaError}
          clearMediaError={thread.clearMediaError} onSendMedia={thread.sendMedia} rootRef={rootRef} onStripChange={changeRecentStrip} />
      </VStack>
    </Host>
    <ChatThreadHeader session={session} peer={peer} title={title} topInset={insets.top} />
    {recentStrip ? <RecentChatPhotoStrip strip={recentStrip} onClose={() => changeRecentStrip(null)}
      backdropVisible={!backdropFailed} onBackdropError={() => setBackdropFailed(true)} /> : null}
    </View>
  </>;
}

const styles = StyleSheet.create({ root: { flex: 1 }, mediaPlaceholder: { width: 200, height: 150 } });
