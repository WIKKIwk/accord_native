import { Button, Host, HStack, Image, ProgressView, ScrollView, Spacer, Text, TextField, useNativeState, VStack } from '@expo/ui/swift-ui';
import { accessibilityLabel, background, buttonStyle, defaultScrollAnchor, defaultScrollAnchorForRole, disabled, font, foregroundStyle, frame, lineLimit, padding, shapes } from '@expo/ui/swift-ui/modifiers';
import { Stack } from 'expo-router';
import { useState } from 'react';
import { Platform, StyleSheet, useColorScheme, useWindowDimensions } from 'react-native';
import type { Session } from '../auth';
import { isMyChatMessage, type ChatMessage } from '../chatModel';
import type { PendingChatText } from '../chatOutbox';
import { useChatThread } from '../useChatThread';

type Props = { session: Session; conversationId: string; title: string };
const secondary = foregroundStyle({ type: 'hierarchical', style: 'secondary' });

function timeLabel(timestamp: number): string {
  const date = new Date(timestamp * 1000);
  return timestamp > 0 && !Number.isNaN(date.getTime()) ? date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }) : '';
}

function MessageBubble({ body, timestamp, mine, status }: { body: string; timestamp: number; mine: boolean; status?: string }) {
  const dark = useColorScheme() === 'dark';
  const { width } = useWindowDimensions();
  return <HStack spacing={0} modifiers={[frame({ maxWidth: Infinity, alignment: mine ? 'trailing' : 'leading' })]}>
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

function ConversationBody({ session, messages, pending, hasMore, loadingMore, error, sendError, sending, onRefresh, onLoadOlder, onRetry }: {
  session: Session; messages: ChatMessage[] | null; pending: PendingChatText[]; hasMore: boolean; loadingMore: boolean;
  error: string; sendError: string; sending: boolean; onRefresh: () => Promise<void>; onLoadOlder: () => Promise<void>; onRetry: () => void;
}) {
  const confirmed = new Set((messages ?? []).filter(message => isMyChatMessage(session, message)).map(message => message.clientMessageId));
  const waiting = pending.filter(item => !confirmed.has(item.clientMessageId));
  const scrollAnchor = Number(Platform.Version) >= 18
    ? [defaultScrollAnchorForRole('bottom', 'initialOffset'), defaultScrollAnchorForRole('bottom', 'alignment')]
    : [defaultScrollAnchor('bottom')];
  return <ScrollView modifiers={[frame({ maxWidth: Infinity, maxHeight: Infinity }), ...scrollAnchor]}>
    <VStack alignment="leading" spacing={12} modifiers={[frame({ maxWidth: Infinity }), padding({ horizontal: 16, vertical: 14 })]}>
      {hasMore ? <HStack><Spacer /><Button label={loadingMore ? 'Yuklanmoqda…' : 'Avvalgi xabarlar'} onPress={() => { void onLoadOlder(); }}
        modifiers={[buttonStyle('bordered'), disabled(loadingMore)]} /><Spacer /></HStack> : null}
      {messages === null && !error ? <HStack spacing={10}><ProgressView /><Text modifiers={[secondary]}>Xabarlar yuklanmoqda…</Text></HStack> : null}
      {error ? <VStack alignment="leading" spacing={8}>
        <Text modifiers={[secondary]}>{error}</Text><Button label="Qayta urinish" onPress={() => { void onRefresh(); }} modifiers={[buttonStyle('bordered')]} />
      </VStack> : null}
      {messages !== null && !messages.length && !waiting.length ? <HStack><Spacer /><Text modifiers={[secondary, padding({ vertical: 20 })]}>Hali xabarlar yo‘q.</Text><Spacer /></HStack> : null}
      {(messages ?? []).map(message => <MessageBubble key={message.id} body={message.body} timestamp={message.timestamp} mine={isMyChatMessage(session, message)} />)}
      {waiting.map(item => <MessageBubble key={item.clientMessageId} body={item.body} timestamp={item.createdAt} mine status={sendError ? 'Yuborilmadi' : sending ? 'Yuborilmoqda…' : 'Kutilmoqda'} />)}
      {sendError ? <HStack><Spacer /><VStack alignment="trailing" spacing={6}>
        <Text modifiers={[font({ textStyle: 'footnote' }), secondary]}>{sendError}</Text>
        <Button label="Qayta urinish" onPress={onRetry} modifiers={[buttonStyle('bordered')]} />
      </VStack></HStack> : null}
    </VStack>
  </ScrollView>;
}

function Composer({ ready, queueing, onSend }: { ready: boolean; queueing: boolean; onSend: (body: string) => Promise<boolean> }) {
  const dark = useColorScheme() === 'dark';
  const [draft, setDraft] = useState('');
  const value = useNativeState('');
  const send = async () => {
    if (!draft.trim() || queueing || !ready) return;
    if (await onSend(draft)) { value.set(''); setDraft(''); }
  };
  return <HStack spacing={8} modifiers={[frame({ maxWidth: Infinity }), padding({ horizontal: 12, top: 8, bottom: 10 })]}>
    <TextField text={value} onTextChange={setDraft} placeholder="Xabar yozing" axis="vertical" maxLength={4000} modifiers={[
      font({ textStyle: 'body' }), lineLimit({ min: 1, max: 4 }), frame({ maxWidth: Infinity, alignment: 'leading' }),
      padding({ horizontal: 14, vertical: 10 }), background(dark ? '#2c2c2e' : '#e9e9eb', shapes.capsule()),
      accessibilityLabel('Xabar matni'), disabled(!ready || queueing),
    ]} />
    <Button onPress={() => { void send(); }} modifiers={[buttonStyle('plain'), accessibilityLabel('Xabarni yuborish'), disabled(!ready || queueing || !draft.trim())]}>
      <Image systemName="arrow.up.circle.fill" size={34} color="#007AFF" />
    </Button>
  </HStack>;
}

export function ChatThreadScreen({ session, conversationId, title }: Props) {
  const thread = useChatThread(session, conversationId);
  return <>
    <Stack.Screen options={{ title: title || 'Suhbat', headerBackButtonDisplayMode: 'minimal' }} />
    <Host style={styles.root}>
      <VStack spacing={0} modifiers={[frame({ maxWidth: Infinity, maxHeight: Infinity })]}>
        <ConversationBody session={session} messages={thread.messages} pending={thread.pending} hasMore={thread.hasMore}
          loadingMore={thread.loadingMore} error={thread.error} sendError={thread.sendError} sending={thread.sending}
          onRefresh={thread.refresh} onLoadOlder={thread.loadOlder} onRetry={thread.retry} />
        <Composer ready={thread.storageReady} queueing={thread.queueing} onSend={thread.send} />
      </VStack>
    </Host>
  </>;
}

const styles = StyleSheet.create({ root: { flex: 1 } });
