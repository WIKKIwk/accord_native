import { Host, OutlinedTextField, Text as ComposeText, useMaterialColors, useNativeState } from '@expo/ui/jetpack-compose';
import { fillMaxWidth } from '@expo/ui/jetpack-compose/modifiers';
import { Stack } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, Text, View } from 'react-native';
import { chatTime, filterChatConversations } from '../chatModel';
import type { ChatConversationsProps } from '../shared/chat/chatPageTypes';
import { useChatConversations } from '../shared/chat/useChatConversations';
import { ChatAvatar } from './ChatAvatar';

export function ChatConversationsScreen({ session, navigation, onOpenDrawer, onBack }: ChatConversationsProps) {
  const state = useChatConversations(session), colors = useMaterialColors(), search = useNativeState('');
  return <View style={{ flex: 1, backgroundColor: colors.surface }}>
    <Stack.Screen options={{ title: 'Chatlar',
      headerLeft: onOpenDrawer || onBack ? () => <Pressable accessibilityRole="button" accessibilityLabel={onBack ? 'Orqaga' : 'Bo‘limlar'}
        onPress={onBack ?? onOpenDrawer} style={{ padding: 12 }}><SymbolView name={{ android: onBack ? 'arrow_back' : 'menu' }} size={24} tintColor={colors.onSurface} /></Pressable> : undefined,
      headerRight: () => <Pressable accessibilityRole="button" accessibilityLabel="Yangi suhbat" onPress={navigation.openDirectory} style={{ padding: 12 }}>
        <SymbolView name={{ android: 'edit_square' }} size={24} tintColor={colors.onSurface} /></Pressable>,
    }} />
    <Host matchContents={{ vertical: true }} style={{ width: '100%', padding: 12 }}>
      <OutlinedTextField value={search} onValueChange={state.setQuery} singleLine modifiers={[fillMaxWidth()]}>
        <OutlinedTextField.Placeholder><ComposeText>Chatlardan qidirish</ComposeText></OutlinedTextField.Placeholder>
      </OutlinedTextField>
    </Host>
    <FlatList data={filterChatConversations(state.items ?? [], state.query)} keyExtractor={item => item.id}
      contentContainerStyle={{ flexGrow: 1, paddingBottom: 16 }}
      refreshControl={<RefreshControl refreshing={state.items === null && !state.error} onRefresh={() => void state.refresh()} />}
      ListHeaderComponent={state.error ? <Pressable onPress={() => void state.refresh()} style={{ padding: 16 }}>
        <Text style={{ color: colors.error }}>{state.error}</Text><Text style={{ color: colors.primary }}>Qayta urinish</Text>
      </Pressable> : undefined}
      ListEmptyComponent={!state.error && state.items !== null ? <Text style={{ color: colors.onSurfaceVariant, padding: 24 }}>
        {state.query.trim() ? 'Chat topilmadi' : 'Hali suhbatlar yo‘q'}</Text> : state.items === null && !state.error ? <ActivityIndicator /> : undefined}
      renderItem={({ item }) => <Pressable accessibilityRole="button" onPress={() => navigation.openConversation(item)}
        style={{ flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12 }}>
        <ChatAvatar session={session} peer={item.peer} token={state.avatarToken} />
        <View style={{ flex: 1, gap: 4 }}><Text numberOfLines={1} style={{ color: colors.onSurface, fontSize: 16, fontWeight: item.unreadCount ? '700' : '500' }}>{item.title}</Text>
          <Text numberOfLines={1} style={{ color: colors.onSurfaceVariant }}>{item.preview}</Text></View>
        <View style={{ alignItems: 'flex-end', gap: 6 }}><Text style={{ color: colors.onSurfaceVariant, fontSize: 12 }}>{chatTime(item.timestamp)}</Text>
          {!!item.unreadCount && <Text style={{ color: colors.onPrimary, backgroundColor: colors.primary, paddingHorizontal: 7, borderRadius: 12 }}>{item.unreadCount > 99 ? '99+' : item.unreadCount}</Text>}</View>
      </Pressable>} />
  </View>;
}
