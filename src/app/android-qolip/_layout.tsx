import { Stack } from 'expo-router';
import { QolipSessionGate } from '../../qolip/QolipSessionGate';
export default function Layout() { return <QolipSessionGate platform="android"><Stack screenOptions={{ headerShown: false }} /></QolipSessionGate>; }
