import { Stack, useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { Text, View } from 'react-native';
import { GScaleScreen } from '../../gscale/GScaleScreen';
import { parseGScaleModeArgs } from '../../gscale/gscaleRouteArgs';

export default function GScaleRoute() {
  const params = useLocalSearchParams<Record<string, string | string[] | undefined>>();
  const key = JSON.stringify(params);
  const args = useMemo(() => {
    try { return parseGScaleModeArgs(JSON.parse(key)); } catch { return null; }
  }, [key]);
  if (!args) return <><Stack.Screen options={{ headerShown: true, title: 'GScale' }} /><View><Text>GScale parametrlari noto‘g‘ri</Text></View></>;
  return <GScaleScreen args={args} />;
}
