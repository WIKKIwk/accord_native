import { Text, type StyleProp, type TextStyle } from 'react-native';

export function WorkerOrderPauseStatus({ message, style }: { message: string; style: StyleProp<TextStyle> }) {
  return <Text style={style}>{message}</Text>;
}
