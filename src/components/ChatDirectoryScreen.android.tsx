import { Host, OutlinedTextField, Text as ComposeText, useMaterialColors, useNativeState } from '@expo/ui/jetpack-compose';
import { fillMaxWidth } from '@expo/ui/jetpack-compose/modifiers';
import { Stack } from 'expo-router';
import { ActivityIndicator, FlatList, Pressable, Text, View } from 'react-native';
import { profileRoleLabel } from '../profileModel';
import type { ChatDirectoryProps } from '../shared/chat/chatPageTypes';
import { useChatDirectory } from '../shared/chat/useChatDirectory';
import { ChatAvatar } from './ChatAvatar';

export function ChatDirectoryScreen({ session, onOpenConversation }: ChatDirectoryProps) {
  const state = useChatDirectory(session, onOpenConversation), colors = useMaterialColors(), search = useNativeState('');
  return <View style={{ flex: 1, backgroundColor: colors.surface }}><Stack.Screen options={{ title: 'Yangi suhbat' }} />
    <Host matchContents={{ vertical: true }} style={{ width: '100%', padding: 12 }}>
      <OutlinedTextField value={search} onValueChange={state.search} singleLine modifiers={[fillMaxWidth()]}>
        <OutlinedTextField.Placeholder><ComposeText>Foydalanuvchi qidirish</ComposeText></OutlinedTextField.Placeholder>
      </OutlinedTextField>
    </Host>
    <FlatList data={state.items ?? []} keyExtractor={item => JSON.stringify([item.role, item.ref])}
      contentContainerStyle={{ flexGrow: 1, paddingBottom: 16 }}
      onEndReached={() => { if (state.hasMore && !state.error) state.loadNextPage(); }} onEndReachedThreshold={0.5}
      ListEmptyComponent={state.items === null && !state.error ? <ActivityIndicator /> : !state.error ? <Text style={{ color: colors.onSurfaceVariant, padding: 24 }}>
        {state.query.trim() ? 'Foydalanuvchi topilmadi' : 'Foydalanuvchilar yo‘q'}</Text> : undefined}
      ListFooterComponent={state.error ? <Pressable onPress={() => void state.load(state.queryRef.current, state.error!.retryOffset)} style={{ padding: 16 }}>
        <Text style={{ color: colors.error }}>{state.error.message}</Text><Text style={{ color: colors.primary }}>Qayta urinish</Text>
      </Pressable> : state.loadingMore ? <ActivityIndicator /> : undefined}
      renderItem={({ item }) => <Pressable accessibilityRole="button" disabled={!!state.openingKey} onPress={() => void state.open(item)}
        style={{ flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12 }}>
        <ChatAvatar session={session} peer={item} token={state.avatarToken} />
        <View style={{ flex: 1, gap: 4 }}><Text style={{ color: colors.onSurface, fontSize: 16 }}>{item.displayName || 'Foydalanuvchi'}</Text>
          <Text style={{ color: colors.onSurfaceVariant }}>{profileRoleLabel(item.role)}</Text></View>
        {state.openingKey === JSON.stringify([item.role, item.ref]) && <ActivityIndicator />}
      </Pressable>} />
  </View>;
}
