import { Text, View } from 'react-native';
import type { Session } from '../auth';

type Props = { session: Session; conversationId: string; title: string };

export function ChatThreadScreen(_props: Props) {
  return <View><Text>Chat hozircha iOS uchun tayyorlanmoqda.</Text></View>;
}
