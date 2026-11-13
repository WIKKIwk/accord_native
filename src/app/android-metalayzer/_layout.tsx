import { Stack } from 'expo-router';
import { MetalayzerDrawer } from '../../metalayzer/MetalayzerDrawer';
import { MetalayzerSessionGate } from '../../metalayzer/MetalayzerSessionGate';
export default function Layout() {
  return <MetalayzerSessionGate platform="android"><MetalayzerDrawer><Stack screenOptions={{ headerShown: false }} /></MetalayzerDrawer></MetalayzerSessionGate>;
}
