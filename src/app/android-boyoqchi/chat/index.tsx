import { View } from 'react-native';
import { BoyoqchiDock } from '../../../boyoqchi/BoyoqchiDock.android';
import { ChatListPage } from '../../../shared/chat/ChatPages';
export default function BoyoqchiChatPage() {
  return <View style={{ flex: 1 }}><View style={{ flex: 1 }}><ChatListPage /></View><BoyoqchiDock active="" /></View>;
}
