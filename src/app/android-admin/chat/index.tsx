import { View } from 'react-native';
import { AdminBottomBar } from '../../../admin/AdminBottomBar.android';
import { ChatListPage } from '../../../shared/chat/ChatPages';

export default function AdminChatPage() {
  return <View style={{ flex: 1 }}><View style={{ flex: 1 }}><ChatListPage /></View><AdminBottomBar active="chat" /></View>;
}
