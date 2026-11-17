import { View } from 'react-native';
import { ChatListPage } from '../../../shared/chat/ChatPages';
import { QolipDock } from '../../../qolip/QolipDock';
export default function Chat() { return <View style={{ flex: 1 }}><View style={{ flex: 1 }}><ChatListPage /></View><QolipDock /></View>; }
