import { Button, Host, HStack, Image, List, ProgressView, RNHostView, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import { buttonStyle, contentShape, disabled, font, foregroundStyle, frame, lineLimit, listRowBackground, listRowInsets, listRowSeparator, listStyle, onAppear, padding, scrollContentBackground, shapes } from '@expo/ui/swift-ui/modifiers';
import { Stack } from 'expo-router';
import { StyleSheet } from 'react-native';
import type { Session } from '../auth';
import type { ChatPeer } from '../chatModel';
import { profileRoleLabel } from '../profileModel';
import { ChatAvatar } from './ChatAvatar';
import { useWorkerColors } from './useWorkerColors';

import type { ChatDirectoryProps } from '../shared/chat/chatPageTypes';
import { useChatDirectory } from '../shared/chat/useChatDirectory';

const secondary = foregroundStyle({ type: 'hierarchical', style: 'secondary' });
const transparentRow = listRowBackground('transparent');
const peerKey = (peer: ChatPeer) => JSON.stringify([peer.role, peer.ref]);

function DirectoryRow({ peer, session, token, opening, busy, onOpen }: {
  peer: ChatPeer; session: Session; token: string | null; opening: boolean; busy: boolean; onOpen: (peer: ChatPeer) => void;
}) {
  return <Button onPress={() => onOpen(peer)} modifiers={[buttonStyle('plain'), transparentRow, disabled(busy), listRowInsets({ top: 0, bottom: 0, leading: 0, trailing: 0 })]}>
    <HStack spacing={12} modifiers={[padding({ horizontal: 16, vertical: 10 }), frame({ maxWidth: Infinity }), contentShape(shapes.rectangle())]}>
      <RNHostView matchContents><ChatAvatar session={session} peer={peer} token={token} /></RNHostView>
      <VStack alignment="leading" spacing={4} modifiers={[frame({ maxWidth: Infinity, alignment: 'leading' })]}>
        <Text modifiers={[font({ textStyle: 'body', weight: 'medium' }), lineLimit(1)]}>{peer.displayName || 'Foydalanuvchi'}</Text>
        <Text modifiers={[font({ textStyle: 'subheadline' }), secondary, lineLimit(1)]}>{profileRoleLabel(peer.role)}</Text>
      </VStack>
      {opening ? <ProgressView /> : null}
    </HStack>
  </Button>;
}

function DirectoryPageFooter({ onVisible }: { onVisible: () => void }) {
  return <HStack modifiers={[transparentRow, padding({ vertical: 10 }), listRowSeparator('hidden'), onAppear(onVisible)]}>
    <Spacer /><ProgressView /><Spacer />
  </HStack>;
}

export function ChatDirectoryScreen({ session, onOpenConversation }: ChatDirectoryProps) {
  const colors = useWorkerColors();
  const { items, query, queryRef, error, hasMore, nextOffset, loadingMore, openingKey, avatarToken, load, loadNextPage, search, open } = useChatDirectory(session, onOpenConversation);
  return <>
    <Stack.Screen options={{
      title: 'Yangi suhbat', headerLargeTitle: true, headerBackButtonDisplayMode: 'minimal',
      headerLargeTitleShadowVisible: false, headerShadowVisible: false, headerTransparent: true, scrollEdgeEffects: { top: 'soft' },
      headerSearchBarOptions: {
        placeholder: 'Foydalanuvchi qidirish', autoCapitalize: 'none', hideWhenScrolling: false, obscureBackground: false,
        onChangeText: event => search(event.nativeEvent.text), onCancelButtonPress: () => search(''),
      },
    }} />
    <Host style={[styles.root, { backgroundColor: colors.background }]}>
      <List modifiers={[listStyle('plain'), scrollContentBackground('hidden')]}>
        {items === null && !error ? <HStack spacing={10} modifiers={[transparentRow, padding({ vertical: 14 }), listRowSeparator('hidden')]}>
          <ProgressView /><Text modifiers={[secondary]}>Foydalanuvchilar yuklanmoqda…</Text>
        </HStack> : null}
        {error && error.retryOffset === 0 ? <VStack alignment="leading" spacing={8} modifiers={[transparentRow, padding({ vertical: 10 }), listRowSeparator('hidden')]}>
          <Text modifiers={[secondary]}>{error.message}</Text>
          <Button label="Qayta urinish" onPress={() => { void load(queryRef.current, error.retryOffset); }} modifiers={[buttonStyle('bordered')]} />
        </VStack> : null}
        {items !== null && !items.length && !error ? <VStack alignment="center" spacing={10} modifiers={[
          transparentRow, frame({ maxWidth: Infinity }), padding({ top: 44, bottom: 24 }), listRowSeparator('hidden'),
        ]}>
          <Image systemName={query.trim() ? 'magnifyingglass' : 'person.2'} size={34} modifiers={[secondary]} />
          <Text modifiers={[font({ textStyle: 'headline' })]}>{query.trim() ? 'Foydalanuvchi topilmadi' : 'Foydalanuvchilar yo‘q'}</Text>
          {query.trim() ? <Text modifiers={[font({ textStyle: 'subheadline' }), secondary]}>Boshqa ism bilan qidirib ko‘ring.</Text> : null}
        </VStack> : null}
        {(items ?? []).map(peer => <DirectoryRow key={peerKey(peer)} peer={peer} session={session} token={avatarToken}
          opening={openingKey === peerKey(peer)} busy={!!openingKey} onOpen={target => { void open(target); }} />)}
        {error && error.retryOffset > 0 ? <VStack alignment="center" spacing={8} modifiers={[transparentRow, padding({ vertical: 10 }), listRowSeparator('hidden')]}>
          <Text modifiers={[secondary]}>{error.message}</Text>
          <Button label="Qayta urinish" onPress={() => { void load(queryRef.current, error.retryOffset); }} modifiers={[buttonStyle('bordered'), disabled(loadingMore)]} />
        </VStack> : null}
        {hasMore && nextOffset > 0 && !error
          ? <DirectoryPageFooter key={`${query}:${nextOffset}`} onVisible={loadNextPage} /> : null}
      </List>
    </Host>
  </>;
}

const styles = StyleSheet.create({ root: { flex: 1 } });
