import { Stack } from 'expo-router';
import { SupplierShell } from '../../supplier/SupplierShell';
export default function SupplierLayout() {
  return <SupplierShell platform="android"><Stack screenOptions={{ headerShown: false }} /></SupplierShell>;
}
