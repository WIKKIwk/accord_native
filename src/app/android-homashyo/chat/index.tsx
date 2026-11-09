import { View } from 'react-native';
import { RawSplitDock } from '../../../homashyo/RawSplitDock.android';
import { ChatListPage } from '../../../shared/chat/ChatPages';
export default function RawSplitChatPage() {
  return <View style={{ flex: 1 }}><View style={{ flex: 1 }}><ChatListPage /></View><RawSplitDock chat /></View>;
}
