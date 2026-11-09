import { Text, View } from 'react-native';

/** The History implementation stays unmounted until its account and data boundaries are reviewed. */
export function MaterialHistoryUnavailable() {
  return <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 }}>
    <Text accessibilityRole="alert" style={{ textAlign: 'center' }}>Harakatlar tarixi hozircha mavjud emas.</Text>
  </View>;
}
