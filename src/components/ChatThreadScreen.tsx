import { Text, View } from 'react-native';
import type { Session } from '../auth';
import type { ChatPeer } from '../chatModel';

type Props = { session: Session; conversationId: string; title: string; peer: ChatPeer | null };

export function ChatThreadScreen(_props: Props) {
  return <View><Text>Chat hozircha iOS uchun tayyorlanmoqda.</Text></View>;
}
