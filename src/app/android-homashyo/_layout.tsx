import { Stack } from 'expo-router';
import { RawSplitDrawer } from '../../homashyo/RawSplitDrawer';
import { RawSplitSessionGate } from '../../homashyo/RawSplitSessionGate';
export default function Layout() {
  return <RawSplitSessionGate platform="android"><RawSplitDrawer><Stack screenOptions={{ headerShown: false }} /></RawSplitDrawer></RawSplitSessionGate>;
}
