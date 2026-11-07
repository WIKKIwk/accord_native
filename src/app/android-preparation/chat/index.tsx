import { View } from 'react-native';
import { PreparationDock } from '../../../preparation/PreparationUI.android';
import { ChatListPage } from '../../../shared/chat/ChatPages';

export default function PreparationChatPage() {
  return <View style={{ flex: 1 }}><View style={{ flex: 1 }}><ChatListPage /></View><PreparationDock chat /></View>;
}
