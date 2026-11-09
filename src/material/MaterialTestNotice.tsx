import { Text, View } from 'react-native';

/** No role screen, shared Profile, logout or network operation is mounted for the reserved test token. */
export function MaterialTestNotice() {
  return <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 }}>
    <Text accessibilityRole="alert" style={{ textAlign: 'center' }}>Ushbu bo‘limda test rejimi hali tayyor emas. Ma’lumotlar serverdan olinmaydi.</Text>
  </View>;
}
