import { Button, Host, HStack, Image, Namespace, Popover, ProgressView, Rectangle, RNHostView, ScrollView, Spacer, Text, TextField, type TextFieldRef, useNativeState, VStack, withAnimation, ZStack } from '@expo/ui/swift-ui';
import { accessibilityLabel, animation, Animation, background, blur, buttonStyle, contentShape, defaultScrollAnchor, defaultScrollAnchorForRole, disabled, fixedSize, font, foregroundStyle, frame, glassEffect, id, layoutPriority, lineLimit, matchedGeometryEffect, offset, onAppear, onGeometryChange, onTapGesture, opacity, padding, scaleEffect, scrollClipDisabled, scrollDismissesKeyboard, scrollEdgeEffectStyle, scrollPosition, scrollTargetLayout, shapes, strokeBorder, zIndex } from '@expo/ui/swift-ui/modifiers';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { Stack } from 'expo-router';
import { useCallback, useEffect, useId, useRef, useState, type ComponentRef, type RefObject } from 'react';
import { Alert, Platform, StyleSheet, useColorScheme, useWindowDimensions, View } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';
import type { Session } from '../auth';
import { draftAfterSending } from '../chatComposer';
import { discardChatMedia, prepareChatDocument, prepareChatMedia, type ChatMediaDraft } from '../chatMedia';
import { chatTimeline, outgoingMessageKey, type ChatAttachment, type ChatMessage, type ChatPeer } from '../chatModel';
import type { PendingChatText } from '../chatOutbox';
import { RECENT_FLIGHT_MS, recentBackGesture } from '../chatRecentPhotoMotion';
import { prepareRecentChatPhoto, type RecentChatPhoto } from '../chatRecentPhotos';
import { useChatThread } from '../useChatThread';
import { CHAT_HEADER_CONTENT_HEIGHT, ChatThreadHeader } from './ChatThreadHeader.ios';
import { ChatMediaThumbnail, openChatMedia, SelectedChatMediaPreview } from './ChatMediaPreview.ios';
import { RecentChatPhotoStrip, RecentChatPhotosButton, type RecentPhotoExit, type RecentPhotoStrip } from './RecentChatPhotos.ios';

type Props = { session: Session; conversationId: string; title: string; peer: ChatPeer | null };
const secondary = foregroundStyle({ type: 'hierarchical', style: 'secondary' });
const MEDIA_LEAVE_MS = 130;
const MEDIA_SPRING = Animation.spring({ response: 0.36, dampingFraction: 0.86 });
const PENDING_SLOT_ID = 'pending-media-slot';
const SEND_SPRING = Animation.spring({ response: 0.42, dampingFraction: 0.82 });
const SEND_FLIGHT_MS = 520;
const SEND_ORIGIN_ID = 'chat-send-origin';
const BUBBLE_TEXT_INSET = 14;

function timeLabel(timestamp: number): string {
  const date = new Date(timestamp * 1000);
  return timestamp > 0 && !Number.isNaN(date.getTime()) ? date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }) : '';
}

function MessageBubble({ session, body, attachment, caption, timestamp, mine, status, messageKey, animate, reduceMotion, namespaceId, onLanded }: {
  session: Session; body: string; attachment?: ChatAttachment; caption?: string; timestamp: number; mine: boolean; status?: string; messageKey: string; animate: boolean;
  reduceMotion: boolean; namespaceId: string; onLanded: (messageKey: string) => void;
}) {
  const dark = useColorScheme() === 'dark';
  const { width } = useWindowDimensions();
  const [shown, setShown] = useState(!animate || reduceMotion);
  const [appeared, setAppeared] = useState(false);
  const [showMedia, setShowMedia] = useState(false);
  // A sent text starts on top of the words in the field, then SwiftUI carries it to its own place.
  const flies = animate && !reduceMotion && mine && !attachment;
  const entrance = !animate || reduceMotion ? []
    : flies ? [opacity(shown ? 1 : 0.6), animation(SEND_SPRING, shown)]
    : [offset({ y: shown ? 0 : 16 }), opacity(shown ? 1 : 0), animation(Animation.spring({ response: 0.35, dampingFraction: 0.86 }), shown)];
  return <HStack spacing={0} modifiers={[
    id(messageKey), frame({ maxWidth: Infinity, alignment: mine ? 'trailing' : 'leading' }),
    ...entrance,
    onAppear(() => {
      if (attachment && !showMedia) setShowMedia(true);
      if (!animate || appeared) return;
      setAppeared(true);
      setShown(true);
      onLanded(messageKey);
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
        padding({ horizontal: BUBBLE_TEXT_INSET, vertical: 10 }), background(mine ? '#007AFF' : dark ? '#2c2c2e' : '#e9e9eb', shapes.roundedRectangle({ cornerRadius: 18 })),
        ...(flies ? [matchedGeometryEffect(SEND_ORIGIN_ID, namespaceId, { properties: 'position', anchor: 'leading', isSource: shown }),
          offset({ x: shown ? 0 : -BUBBLE_TEXT_INSET })] : []),
      ]}>{body}</Text>}
      {/* The time waits for the bubble to arrive instead of flying along with it. */}
      <Text modifiers={[font({ textStyle: 'caption2' }), secondary,
        ...(flies ? [opacity(shown ? 1 : 0), animation(Animation.easeOut({ duration: 0.18 }).delay(0.24), shown)] : []),
      ]}>{[timeLabel(timestamp), status].filter(Boolean).join(' · ')}</Text>
    </VStack>
    {!mine ? <Spacer /> : null}
  </HStack>;
}

function ConversationBody({ session, messages, pending, hasMore, loadingMore, error, sendError, sending, newKey, reduceMotion, headerBottom, blurFallback, namespaceId, onSendLanded, onRefresh, onLoadOlder, onRetry, onDismissKeyboard }: {
  session: Session; messages: ChatMessage[] | null; pending: PendingChatText[]; hasMore: boolean; loadingMore: boolean;
  error: string; sendError: string; sending: boolean; newKey: string | null; reduceMotion: boolean; headerBottom: number; blurFallback: boolean;
  namespaceId: string; onSendLanded: (messageKey: string) => void;
  onRefresh: () => Promise<void>; onLoadOlder: () => Promise<void>; onRetry: () => void; onDismissKeyboard: () => void;
}) {
  const rows = chatTimeline(session, messages ?? [], pending);
  const [scrollTop, setScrollTop] = useState<number | null>(null);
  const measureScroll = useCallback(({ y }: { y: number }) => {
    setScrollTop(current => current !== null && Math.abs(current - y) < 0.5 ? current : y);
  }, []);
  const position = useNativeState<string | null>(null);
  // The list sits above the composer only while a new bubble is crossing it.
  const [settledKey, setSettledKey] = useState<string | null>(null);
  const crossing = !reduceMotion && !!newKey && newKey !== settledKey;
  useEffect(() => {
    if (!newKey) return;
    const frameId = requestAnimationFrame(() => {
      withAnimation(reduceMotion ? null : SEND_SPRING, () => {
        'worklet';
        position.value = newKey;
      });
    });
    const settle = setTimeout(() => setSettledKey(newKey), SEND_FLIGHT_MS);
    return () => { cancelAnimationFrame(frameId); clearTimeout(settle); };
  }, [newKey, position, reduceMotion]);
  const scrollAnchor = Number(Platform.Version) >= 18
    ? [defaultScrollAnchorForRole('bottom', 'initialOffset'), defaultScrollAnchorForRole('bottom', 'alignment')]
    : [defaultScrollAnchor('bottom')];
  return <ScrollView modifiers={[
    frame({ maxWidth: Infinity, maxHeight: Infinity }), ...scrollAnchor, scrollPosition(position, { anchor: 'bottom' }),
    scrollDismissesKeyboard('interactively'), scrollClipDisabled(), scrollEdgeEffectStyle('soft', 'top'),
    onTapGesture(onDismissKeyboard), onGeometryChange(measureScroll), blur(blurFallback ? 8 : 0),
    ...(reduceMotion ? [] : [animation(Animation.easeOut({ duration: 0.21 }), blurFallback)]),
    zIndex(crossing ? 1 : 0),
  ]}>
    <VStack alignment="leading" spacing={12} modifiers={[
      scrollTargetLayout(), frame({ maxWidth: Infinity }),
      padding({ horizontal: 16, top: Math.max(14, headerBottom - (scrollTop ?? 0) + 8), bottom: 14 }),
      ...(reduceMotion ? [] : [animation(SEND_SPRING, pending.length)]),
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
        animate={row.key === newKey} reduceMotion={reduceMotion} namespaceId={namespaceId} onLanded={onSendLanded} />)}
      {sendError ? <HStack><Spacer /><VStack alignment="trailing" spacing={6}>
        <Text modifiers={[font({ textStyle: 'footnote' }), secondary]}>{sendError}</Text>
        <Button label="Qayta urinish" onPress={onRetry} modifiers={[buttonStyle('bordered')]} />
      </VStack></HStack> : null}
    </VStack>
  </ScrollView>;
}

function Composer({ ready, queueing, mediaSending, mediaProgress, mediaError, clearMediaError, onSend, onSendMedia, inputRef, rootRef, reduceMotion, namespaceId, sendFlying, recentStripOpen, onStripChange, onRecentHoldChange, onMediaCountChange }: {
  ready: boolean; queueing: boolean; mediaSending: boolean; mediaProgress: string; mediaError: string; clearMediaError: () => void;
  onSend: (body: string) => Promise<boolean>; onSendMedia: (media: ChatMediaDraft, caption: string) => Promise<boolean>; inputRef: RefObject<TextFieldRef | null>;
  rootRef: RefObject<ComponentRef<typeof View> | null>; reduceMotion: boolean; namespaceId: string; sendFlying: boolean; recentStripOpen: boolean; onStripChange: (strip: RecentPhotoStrip | null) => void;
  onRecentHoldChange: (holding: boolean) => void; onMediaCountChange: (count: number) => void;
}) {
  const dark = useColorScheme() === 'dark';
  const [draft, setDraft] = useState('');
  const [media, setMedia] = useState<ChatMediaDraft[]>([]);
  const [leavingMedia, setLeavingMedia] = useState<string[]>([]);
  const [pendingSlot, setPendingSlot] = useState(false);
  const trayPosition = useNativeState<string | null>(null);
  const trayTarget = pendingSlot ? PENDING_SLOT_ID : media.at(-1)?.clientMessageId ?? null;
  useEffect(() => {
    if (!trayTarget) return;
    const frameId = requestAnimationFrame(() => {
      withAnimation(reduceMotion ? null : MEDIA_SPRING, () => {
        'worklet';
        trayPosition.value = trayTarget;
      });
    });
    return () => cancelAnimationFrame(frameId);
  }, [reduceMotion, trayPosition, trayTarget]);
  const [composerHeight, setComposerHeight] = useState(0);
  const [landingMedia, setLandingMedia] = useState<string | null>(null);
  const mediaTimers = useRef(new Set<ReturnType<typeof setTimeout>>());
  const measureComposer = useCallback(({ height }: { height: number }) => {
    setComposerHeight(current => Math.abs(current - height) < 0.5 ? current : height);
  }, []);
  const [selecting, setSelecting] = useState(false);
  const [batchSending, setBatchSending] = useState(false);
  const [mediaMenuOpen, setMediaMenuOpen] = useState(false);
  const selected = useRef<ChatMediaDraft[]>([]);
  const previewWaiters = useRef(new Map<string, () => void>());
  const settlePreview = (id: string) => {
    previewWaiters.current.get(id)?.();
    previewWaiters.current.delete(id);
  };
  const batchInProgress = useRef(false);
  const consumedCaption = useRef<string | null>(null);
  const menuDismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const value = useNativeState('');
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; const timers = mediaTimers.current; return () => {
    mounted.current = false;
    if (menuDismissTimer.current !== null) clearTimeout(menuDismissTimer.current);
    timers.forEach(timer => clearTimeout(timer));
    selected.current.forEach(discardChatMedia);
  }; }, []);
  const busyMedia = mediaSending || batchSending;
  const sendableMedia = media.filter(item => !leavingMedia.includes(item.clientMessageId));
  const canSend = ready && !queueing && !busyMedia && !selecting && (!!draft.trim() || sendableMedia.length > 0);
  const surface = Number(Platform.Version) >= 26
    ? [glassEffect({ glass: { variant: 'regular' }, shape: 'roundedRectangle', cornerRadius: 23 })]
    : [
        background({ type: 'material', material: 'regular' }, shapes.roundedRectangle({ cornerRadius: 23 })),
        strokeBorder({ shape: 'roundedRectangle', cornerRadius: 23, content: dark ? '#545456' : '#c7c7cc', style: { lineWidth: 1 } }),
      ];
  const clearSentText = (sent: string) => {
    // Animated, so a field holding several lines closes softly as its text leaves.
    withAnimation(reduceMotion ? null : SEND_SPRING, () => {
      'worklet';
      const current = value.value;
      const next = draftAfterSending(sent, current);
      if (next !== current) {
        value.value = next;
        scheduleOnRN(setDraft, next);
      }
    });
  };
  // The screen animates on this count, so it must change in the same update as the tray.
  const commitMedia = (next: ChatMediaDraft[]) => {
    selected.current = next;
    setMedia(next);
    onMediaCountChange(next.length);
  };
  const removeMedia = (item: ChatMediaDraft) => {
    commitMedia(selected.current.filter(value => value.clientMessageId !== item.clientMessageId));
    settlePreview(item.clientMessageId);
    discardChatMedia(item);
  };
  // The photo fades out first; only then does the composer close the space it leaves.
  const dismissMedia = (item: ChatMediaDraft) => {
    clearMediaError();
    if (reduceMotion) { removeMedia(item); return; }
    setLeavingMedia(ids => [...ids, item.clientMessageId]);
    const timer = setTimeout(() => {
      mediaTimers.current.delete(timer);
      removeMedia(item);
      setLeavingMedia(ids => ids.filter(id => id !== item.clientMessageId));
    }, MEDIA_LEAVE_MS);
    mediaTimers.current.add(timer);
  };
  const send = async () => {
    if (!canSend || batchInProgress.current) return;
    const sent = value.get();
    const caption = consumedCaption.current === sent ? '' : sent;
    if (!caption.trim() && !sendableMedia.length) return;
    if (!sendableMedia.length) {
      if (await onSend(caption) && mounted.current) clearSentText(sent);
      return;
    }
    batchInProgress.current = true;
    setBatchSending(true);
    try {
      for (let index = 0; index < sendableMedia.length; index++) {
        const item = sendableMedia[index];
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
    commitMedia([...selected.current, next]);
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
    // Open the photo's slot now, so the tray is ready before the flying photo arrives.
    setPendingSlot(true);
    onMediaCountChange(selected.current.length + 1);
    clearMediaError();
    // The flying photo owns the slot until it arrives; its preview stays hidden until then.
    let landed = reduceMotion;
    const landingTimer = setTimeout(() => {
      mediaTimers.current.delete(landingTimer);
      landed = true;
      setLandingMedia(null);
    }, RECENT_FLIGHT_MS);
    mediaTimers.current.add(landingTimer);
    let previewShown: Promise<void> | undefined;
    try {
      const next = await prepareRecentChatPhoto(photo);
      previewShown = new Promise(resolve => { previewWaiters.current.set(next.clientMessageId, resolve); });
      if (!landed) setLandingMedia(next.clientMessageId);
      acceptMedia(next);
    }
    catch (reason) {
      if (mounted.current) {
        onMediaCountChange(selected.current.length);
        Alert.alert('Rasm tanlanmadi', reason instanceof Error ? reason.message : 'Qayta urinib ko‘ring.');
      }
    }
    finally { if (mounted.current) { setPendingSlot(false); setSelecting(false); } }
    // A landing photo stays in place until this resolves, so the slot is never seen empty.
    await previewShown;
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
    ...surface, padding({ horizontal: 12, top: 8, bottom: 8 }), layoutPriority(1), onGeometryChange(measureComposer),
  ]}>
    {media.length || pendingSlot ? <VStack alignment="leading" spacing={4} modifiers={[frame({ maxWidth: Infinity, alignment: 'leading' })]}>
      <ScrollView axes="horizontal" showsIndicators={false} modifiers={[
        frame({ maxWidth: Infinity, minHeight: 108, maxHeight: 108 }), scrollPosition(trayPosition, { anchor: 'trailing' }),
      ]}>
        {/* Each slot carries its own trailing gap, so scrolling to it leaves that gap at the tray's edge. */}
        <HStack spacing={0} modifiers={[scrollTargetLayout(), padding({ leading: 8, top: 8, bottom: 4 })]}>
          {media.map(item => {
            const leaving = leavingMedia.includes(item.clientMessageId);
            const landing = landingMedia === item.clientMessageId;
            return <ZStack key={item.clientMessageId} alignment="topTrailing" modifiers={[
              ...(reduceMotion ? [] : [opacity(leaving || landing ? 0 : 1), scaleEffect(leaving ? 0.82 : 1),
                animation(Animation.easeOut({ duration: MEDIA_LEAVE_MS / 1000 }), leaving)]),
              padding({ trailing: 8 }), id(item.clientMessageId),
            ]}>
              <RNHostView matchContents><SelectedChatMediaPreview draft={item} onImageSettled={() => settlePreview(item.clientMessageId)} /></RNHostView>
              {!busyMedia && !leaving && !landing ? <Button onPress={() => dismissMedia(item)} modifiers={[
                buttonStyle('plain'), accessibilityLabel('Media faylni olib tashlash'), disabled(selecting),
              ]}>
                {/* The mark stays small in the corner; its tap target covers the whole corner of the photo. */}
                <Image systemName="xmark" size={11} color="#ffffff" modifiers={[
                  frame({ width: 24, height: 24 }), background('#000000aa', shapes.circle()), padding({ top: 4, trailing: 4 }),
                  frame({ width: 56, height: 56, alignment: 'topTrailing' }), contentShape(shapes.rectangle()),
                ]} />
              </Button> : null}
            </ZStack>;
          })}
          {pendingSlot ? <Rectangle modifiers={[foregroundStyle('#00000000'), frame({ width: 96, height: 96 }), padding({ trailing: 8 }), id(PENDING_SLOT_ID)]} /> : null}
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
        <RNHostView matchContents><RecentChatPhotosButton enabled={ready && !selecting && !busyMedia} stripOpen={recentStripOpen} rootRef={rootRef}
          composer={{ height: composerHeight, attachments: media.length }}
          onTap={() => setMediaMenuOpen(true)} onSelect={selectRecentPhoto} onStripChange={onStripChange} onHoldChange={onRecentHoldChange} /></RNHostView>
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
    <ZStack alignment="leading" modifiers={[frame({ maxWidth: Infinity })]}>
      <TextField ref={inputRef} text={value} onTextChange={text => {
        if (consumedCaption.current !== null && text !== consumedCaption.current) consumedCaption.current = null;
        setDraft(text);
      }} placeholder="Xabar yozing" axis="vertical" maxLength={4000} modifiers={[
        font({ textStyle: 'body' }), lineLimit({ min: 1, max: 4 }), fixedSize({ horizontal: false, vertical: true }),
        padding({ vertical: 8 }), frame({ maxWidth: Infinity, minHeight: 40, alignment: 'leading' }),
        accessibilityLabel('Xabar matni'), disabled(!ready),
      ]} />
      {/* An invisible marker where the typed words begin: the point a sent bubble starts from. */}
      <Rectangle modifiers={[foregroundStyle('#00000000'), frame({ width: 2, height: 2 }),
        matchedGeometryEffect(SEND_ORIGIN_ID, namespaceId, { properties: 'position', anchor: 'leading', isSource: sendFlying })]} />
    </ZStack>
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
  const [failedBackdropStrip, setFailedBackdropStrip] = useState<number | null>(null);
  const [mediaCount, setMediaCount] = useState(0);
  const [recentHolding, setRecentHolding] = useState(false);
  const namespaceId = useId();
  const newKey = thread.lastQueuedId ? outgoingMessageKey(thread.lastQueuedId) : null;
  const [landedKey, setLandedKey] = useState<string | null>(null);
  const sendFlying = !reduceMotion && !!newKey && newKey !== landedKey;
  const backdropFailed = !!recentStrip && recentStrip.id === failedBackdropStrip;
  const dismissRecentStrip = useCallback((exit: RecentPhotoExit) => {
    setRecentStrip(current => current && !current.exit ? { ...current, selected: exit.index, exit } : current);
  }, []);
  const insets = useSafeAreaInsets();
  return <>
    <Stack.Screen options={{ title: title || 'Suhbat', headerTitle: '', headerBackButtonDisplayMode: 'minimal',
      headerTransparent: true, headerShadowVisible: false, scrollEdgeEffects: { top: 'soft' },
      ...recentBackGesture(recentHolding || !!recentStrip) }} />
    <View ref={rootRef} collapsable={false} style={[styles.root, { backgroundColor: dark ? '#000000' : '#ffffff' }]}>
    <Host style={styles.root}>
      <Namespace id={namespaceId}>
      <VStack spacing={0} modifiers={[frame({ maxWidth: Infinity, maxHeight: Infinity }),
        ...(reduceMotion ? [] : [animation(MEDIA_SPRING, mediaCount)])]}>
        <ConversationBody session={session} messages={thread.messages} pending={thread.pending} hasMore={thread.hasMore}
          loadingMore={thread.loadingMore} error={thread.error} sendError={thread.sendError} sending={thread.sending}
          newKey={newKey} reduceMotion={reduceMotion} headerBottom={insets.top + CHAT_HEADER_CONTENT_HEIGHT}
          blurFallback={backdropFailed && !recentStrip?.exit} namespaceId={namespaceId} onSendLanded={setLandedKey}
          onRefresh={thread.refresh} onLoadOlder={thread.loadOlder} onRetry={thread.retry} onDismissKeyboard={() => { void inputRef.current?.blur(); }} />
        <Composer ready={thread.storageReady} queueing={thread.queueing} onSend={thread.send} inputRef={inputRef}
          mediaSending={thread.mediaSending} mediaProgress={thread.mediaProgress} mediaError={thread.mediaError}
          clearMediaError={thread.clearMediaError} onSendMedia={thread.sendMedia} rootRef={rootRef} reduceMotion={reduceMotion} namespaceId={namespaceId} sendFlying={sendFlying} recentStripOpen={!!recentStrip}
          onStripChange={setRecentStrip} onRecentHoldChange={setRecentHolding} onMediaCountChange={setMediaCount} />
      </VStack>
      </Namespace>
    </Host>
    <ChatThreadHeader session={session} peer={peer} title={title} topInset={insets.top} />
    {recentStrip ? <RecentChatPhotoStrip key={recentStrip.id} strip={recentStrip} onDismiss={dismissRecentStrip} onClose={() => setRecentStrip(null)} reduceMotion={reduceMotion}
      backdropVisible={!backdropFailed} onBackdropError={() => setFailedBackdropStrip(recentStrip.id)} /> : null}
    </View>
  </>;
}

const styles = StyleSheet.create({ root: { flex: 1 }, mediaPlaceholder: { width: 200, height: 150 } });
