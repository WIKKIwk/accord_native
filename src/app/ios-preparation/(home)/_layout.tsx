import { Stack } from 'expo-router';
import { PreparationMenu } from '../../../preparation/PreparationMenu';
export default function PreparationHomeLayout() {
  return <Stack screenOptions={{ headerRight: () => <PreparationMenu /> }} />;
}
