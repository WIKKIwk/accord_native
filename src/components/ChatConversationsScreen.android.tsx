import { useMaterialColors } from '@expo/ui/jetpack-compose';
import { Stack, router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { chatTime, filterChatConversations } from '../chatModel';
import type { ChatConversationsProps } from '../shared/chat/chatPageTypes';
import { useChatConversations } from '../shared/chat/useChatConversations';
import { OrdersHeader } from '../shared/orders/OrdersHeader';
import { OrdersList } from '../shared/orders/OrdersList';
import { ChatAvatar } from './ChatAvatar';
import { WorkerQueueCard } from './WorkerQueueCard.android';

const passthroughListItems = () => true;

export function ChatConversationsScreen({ session, navigation, onOpenDrawer, onBack }: ChatConversationsProps) {
  const state = useChatConversations(session), colors = useMaterialColors(), insets = useSafeAreaInsets();
  const headerOffset = useSharedValue(0), headerHeight = useSharedValue(0);
  const visible = filterChatConversations(state.items ?? [], state.query);
  const leading = onBack ? { onBack } : onOpenDrawer ? { onMenu: onOpenDrawer } : { onBack: () => router.back() };
  return <GestureHandlerRootView style={styles.root}>
    <View style={[styles.root, { backgroundColor: colors.surfaceContainerLow, paddingTop: insets.top }]}>
      <Stack.Screen options={{ title: 'Chatlar', headerShown: false }} />
      <OrdersHeader {...leading} search={state.query} searchPlaceholder="Chatlardan qidirish" onSearchChange={state.setQuery}
        trailing={<Pressable accessibilityRole="button" accessibilityLabel="Yangi suhbat" onPress={navigation.openDirectory}
          style={styles.compose} hitSlop={8}>
          <SymbolView name={{ android: 'edit_square' }} size={25} tintColor={colors.onSurfaceVariant} />
        </Pressable>} />
      <OrdersList active headerOffset={headerOffset} headerHeight={headerHeight} topInset={8}
        passthrough={passthroughListItems} onRefresh={state.refresh}>
      {state.error ? <Pressable accessibilityRole="button" onPress={() => void state.refresh()} style={styles.error}>
        <Text style={{ color: colors.error }}>{state.error}</Text><Text style={{ color: colors.primary }}>Qayta urinish</Text>
      </Pressable> : null}
      {!state.error && state.items === null ? <View style={styles.empty}><ActivityIndicator color={colors.primary} /></View> : null}
      {!state.error && state.items !== null && !visible.length ? <View style={styles.empty}>
        <SymbolView name={{ android: state.query.trim() ? 'search' : 'chat_bubble' }} size={32} tintColor={colors.onSurfaceVariant} />
        <Text style={{ color: colors.onSurfaceVariant }}>{state.query.trim() ? 'Chat topilmadi' : 'Hali suhbatlar yo‘q'}</Text>
      </View> : null}
      {visible.map((item, index) => <WorkerQueueCard key={item.id} backgroundColor={colors.surface} first={index === 0}
        last={index === visible.length - 1} onPress={() => navigation.openConversation(item)}>
        <ChatAvatar session={session} peer={item.peer} token={state.avatarToken} size={40} />
        <View style={styles.conversation}>
          <Text numberOfLines={1} style={[styles.title, { color: colors.onSurface, fontWeight: item.unreadCount ? '700' : '500' }]}>{item.title}</Text>
          <Text numberOfLines={1} style={[styles.preview, { color: colors.onSurfaceVariant }]}>{item.preview}</Text>
        </View>
        <View style={styles.metadata}>
          <Text style={[styles.time, { color: item.unreadCount ? colors.primary : colors.onSurfaceVariant }]}>{chatTime(item.timestamp)}</Text>
          {!!item.unreadCount && <Text style={[styles.badge, { color: colors.onPrimary, backgroundColor: colors.primary }]}>{item.unreadCount > 99 ? '99+' : item.unreadCount}</Text>}
        </View>
      </WorkerQueueCard>)}
      </OrdersList>
    </View>
  </GestureHandlerRootView>;
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  compose: { width: 38, height: 48, alignItems: 'center', justifyContent: 'center' },
  error: { padding: 16, gap: 8 },
  empty: { padding: 32, minHeight: 160, alignItems: 'center', justifyContent: 'center', gap: 12 },
  conversation: { flex: 1, marginStart: 16 },
  title: { fontSize: 16, lineHeight: 24, includeFontPadding: false },
  preview: { fontSize: 14, lineHeight: 20, includeFontPadding: false },
  metadata: { alignItems: 'flex-end', marginStart: 12, gap: 6 },
  time: { fontSize: 12, lineHeight: 16, includeFontPadding: false },
  badge: { minWidth: 22, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 12, fontSize: 12, lineHeight: 16, textAlign: 'center', overflow: 'hidden' },
});
