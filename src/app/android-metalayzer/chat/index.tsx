import { View } from 'react-native';
import { MetalayzerDock } from '../../../metalayzer/MetalayzerFrame.android';
import { ChatListPage } from '../../../shared/chat/ChatPages';
export default function Chat() {
  return <View style={{ flex: 1 }}><View style={{ flex: 1 }}><ChatListPage /></View><MetalayzerDock active="chat" /></View>;
}
