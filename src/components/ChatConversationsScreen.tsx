import { Text, View } from 'react-native';
import type { Session } from '../auth';

type Props = { session: Session; onOpenDrawer?: () => void };

export function ChatConversationsScreen(_props: Props) {
  return <View><Text>Chat hozircha iOS uchun tayyorlanmoqda.</Text></View>;
}
