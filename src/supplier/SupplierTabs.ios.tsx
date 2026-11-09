import { NativeTabs } from 'expo-router/native-tabs';
import { useSupplierText } from './useSupplierOverview';

export function SupplierTabs() {
  const { l } = useSupplierText();
  return <NativeTabs>
    <NativeTabs.Trigger name="(home)"><NativeTabs.Trigger.Icon sf={{ default: 'house', selected: 'house.fill' }} />
      <NativeTabs.Trigger.Label>{l('homeNavTitle')}</NativeTabs.Trigger.Label></NativeTabs.Trigger>
    <NativeTabs.Trigger name="recent"><NativeTabs.Trigger.Icon sf="clock.arrow.circlepath" />
      <NativeTabs.Trigger.Label>{l('historyNavTitle')}</NativeTabs.Trigger.Label></NativeTabs.Trigger>
  </NativeTabs>;
}
