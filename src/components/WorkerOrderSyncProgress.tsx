import { useEffect, useState } from 'react';
import { ActivityIndicator, type ColorValue } from 'react-native';

/** @v2 _OrdersConnectionProgress */
export function WorkerOrderSyncProgress({ pending, color }: { pending: boolean; color: ColorValue }) {
  return pending ? <DelayedProgress color={color} /> : null;
}
function DelayedProgress({ color }: { color: ColorValue }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), 2000);
    return () => clearTimeout(timer);
  }, []);
  return visible ? <ActivityIndicator color={color} /> : null;
}
