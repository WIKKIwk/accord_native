import { Button, Host, HStack, Image, ProgressView, ScrollView, Spacer, Text, TextField, type TextFieldRef, useNativeState, VStack, withAnimation } from '@expo/ui/swift-ui';
import { accessibilityLabel, animation, Animation, background, buttonStyle, defaultScrollAnchor, defaultScrollAnchorForRole, disabled, fixedSize, font, foregroundStyle, frame, glassEffect, id, layoutPriority, lineLimit, offset, onAppear, onGeometryChange, onTapGesture, opacity, padding, scrollClipDisabled, scrollDismissesKeyboard, scrollPosition, scrollTargetLayout, shapes, strokeBorder } from '@expo/ui/swift-ui/modifiers';
import { Stack } from 'expo-router';
import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { Platform, StyleSheet, useColorScheme, useWindowDimensions, View } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN, scheduleOnUI } from 'react-native-worklets';
import type { Session } from '../auth';
import { draftAfterSending } from '../chatComposer';
import { chatTimeline, outgoingMessageKey, type ChatMessage, type ChatPeer } from '../chatModel';
import type { PendingChatText } from '../chatOutbox';
import { useChatThread } from '../useChatThread';
import { CHAT_HEADER_CONTENT_HEIGHT, ChatThreadHeader } from './ChatThreadHeader.ios';

type Props = { session: Session; conversationId: string; title: string; peer: ChatPeer | null };
const secondary = foregroundStyle({ type: 'hierarchical', style: 'secondary' });

function timeLabel(timestamp: number): string {
  const date = new Date(timestamp * 1000);
  return timestamp > 0 && !Number.isNaN(date.getTime()) ? date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }) : '';
}

function MessageBubble({ body, timestamp, mine, status, messageKey, animate, reduceMotion }: {
  body: string; timestamp: number; mine: boolean; status?: string; messageKey: string; animate: boolean;
  reduceMotion: boolean;
}) {
  const dark = useColorScheme() === 'dark';
  const { width } = useWindowDimensions();
  const [shown, setShown] = useState(!animate || reduceMotion);
  const [appeared, setAppeared] = useState(false);
  return <HStack spacing={0} modifiers={[
    id(messageKey), frame({ maxWidth: Infinity, alignment: mine ? 'trailing' : 'leading' }),
    ...(animate && !reduceMotion ? [offset({ y: shown ? 0 : 16 }), opacity(shown ? 1 : 0),
      animation(Animation.spring({ response: 0.35, dampingFraction: 0.86 }), shown)] : []),
    onAppear(() => {
      if (!animate || appeared) return;
      setAppeared(true);
      setShown(true);
    }),
  ]}>
    {mine ? <Spacer /> : null}
    <VStack alignment={mine ? 'trailing' : 'leading'} spacing={4} modifiers={[frame({ maxWidth: width * 0.76, alignment: mine ? 'trailing' : 'leading' })]}>
      <Text modifiers={[
        font({ textStyle: 'body' }), foregroundStyle(mine ? '#ffffff' : dark ? '#ffffff' : '#000000'),
        padding({ horizontal: 14, vertical: 10 }), background(mine ? '#007AFF' : dark ? '#2c2c2e' : '#e9e9eb', shapes.roundedRectangle({ cornerRadius: 18 })),
      ]}>{body}</Text>
      <Text modifiers={[font({ textStyle: 'caption2' }), secondary]}>{[timeLabel(timestamp), status].filter(Boolean).join(' · ')}</Text>
    </VStack>
    {!mine ? <Spacer /> : null}
  </HStack>;
}

function ConversationBody({ session, messages, pending, hasMore, loadingMore, error, sendError, sending, lastQueuedId, reduceMotion, headerBottom, onRefresh, onLoadOlder, onRetry, onDismissKeyboard }: {
  session: Session; messages: ChatMessage[] | null; pending: PendingChatText[]; hasMore: boolean; loadingMore: boolean;
  error: string; sendError: string; sending: boolean; lastQueuedId: string | null; reduceMotion: boolean; headerBottom: number;
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
    scrollDismissesKeyboard('interactively'), scrollClipDisabled(), onTapGesture(onDismissKeyboard), onGeometryChange(measureScroll),
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
      {rows.map(row => <MessageBubble key={row.key} messageKey={row.key} body={row.body} timestamp={row.timestamp} mine={row.mine}
        status={row.pending ? sendError ? 'Yuborilmadi' : sending ? 'Yuborilmoqda…' : 'Kutilmoqda' : undefined}
        animate={row.key === newKey} reduceMotion={reduceMotion} />)}
      {sendError ? <HStack><Spacer /><VStack alignment="trailing" spacing={6}>
        <Text modifiers={[font({ textStyle: 'footnote' }), secondary]}>{sendError}</Text>
        <Button label="Qayta urinish" onPress={onRetry} modifiers={[buttonStyle('bordered')]} />
      </VStack></HStack> : null}
    </VStack>
  </ScrollView>;
}

function Composer({ ready, queueing, onSend, inputRef }: {
  ready: boolean; queueing: boolean; onSend: (body: string) => Promise<boolean>; inputRef: RefObject<TextFieldRef | null>;
}) {
  const dark = useColorScheme() === 'dark';
  const [draft, setDraft] = useState('');
  const value = useNativeState('');
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const canSend = ready && !queueing && !!draft.trim();
  const surface = Number(Platform.Version) >= 26
    ? [glassEffect({ glass: { variant: 'regular' }, shape: 'roundedRectangle', cornerRadius: 23 })]
    : [
        background({ type: 'material', material: 'regular' }, shapes.roundedRectangle({ cornerRadius: 23 })),
        strokeBorder({ shape: 'roundedRectangle', cornerRadius: 23, content: dark ? '#545456' : '#c7c7cc', style: { lineWidth: 1 } }),
      ];
  const send = async () => {
    if (!canSend) return;
    const sent = value.get();
    if (!sent.trim()) return;
    if (await onSend(sent) && mounted.current) {
      scheduleOnUI(() => {
        'worklet';
        const current = value.value;
        const next = draftAfterSending(sent, current);
        if (next !== current) {
          value.value = next;
          scheduleOnRN(setDraft, next);
        }
      });
    }
  };
  return <HStack alignment="bottom" spacing={4} modifiers={[
    padding({ leading: 16, trailing: 3, vertical: 3 }), frame({ minHeight: 46, maxWidth: Infinity }),
    ...surface, padding({ horizontal: 12, top: 8, bottom: 8 }), layoutPriority(1),
  ]}>
    <TextField ref={inputRef} text={value} onTextChange={setDraft} placeholder="Xabar yozing" axis="vertical" maxLength={4000} modifiers={[
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
  </HStack>;
}

export function ChatThreadScreen({ session, conversationId, title, peer }: Props) {
  const thread = useChatThread(session, conversationId);
  const reduceMotion = useReducedMotion();
  const inputRef = useRef<TextFieldRef>(null);
  const insets = useSafeAreaInsets();
  return <>
    <Stack.Screen options={{ title: title || 'Suhbat', headerTitle: '', headerBackButtonDisplayMode: 'minimal',
      headerTransparent: true, headerShadowVisible: false, scrollEdgeEffects: { top: 'soft' } }} />
    <View style={styles.root}>
    <Host style={styles.root}>
      <VStack spacing={0} modifiers={[frame({ maxWidth: Infinity, maxHeight: Infinity })]}>
        <ConversationBody session={session} messages={thread.messages} pending={thread.pending} hasMore={thread.hasMore}
          loadingMore={thread.loadingMore} error={thread.error} sendError={thread.sendError} sending={thread.sending}
          lastQueuedId={thread.lastQueuedId} reduceMotion={reduceMotion} headerBottom={insets.top + CHAT_HEADER_CONTENT_HEIGHT}
          onRefresh={thread.refresh} onLoadOlder={thread.loadOlder} onRetry={thread.retry} onDismissKeyboard={() => { void inputRef.current?.blur(); }} />
        <Composer ready={thread.storageReady} queueing={thread.queueing} onSend={thread.send} inputRef={inputRef} />
      </VStack>
    </Host>
    <ChatThreadHeader session={session} peer={peer} title={title} topInset={insets.top} />
    </View>
  </>;
}

const styles = StyleSheet.create({ root: { flex: 1 } });
