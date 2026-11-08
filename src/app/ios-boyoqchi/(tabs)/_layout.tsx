import { NativeTabs } from 'expo-router/native-tabs';
import { useBoyoqchiGetter, useBoyoqchiText } from '../../../boyoqchi/useBoyoqchiText';
export default function BoyoqchiTabs() {
  const getter = useBoyoqchiGetter(), t = useBoyoqchiText();
  return <NativeTabs>
    <NativeTabs.Trigger name="(home)"><NativeTabs.Trigger.Icon sf={{ default: 'house', selected: 'house.fill' }} />
      <NativeTabs.Trigger.Label>{getter('homeNavTitle')}</NativeTabs.Trigger.Label></NativeTabs.Trigger>
    <NativeTabs.Trigger name="(astatka)"><NativeTabs.Trigger.Icon sf={{ default: 'shippingbox', selected: 'shippingbox.fill' }} />
      <NativeTabs.Trigger.Label>{t('Astatka')}</NativeTabs.Trigger.Label></NativeTabs.Trigger>
    <NativeTabs.Trigger name="profile"><NativeTabs.Trigger.Icon sf={{ default: 'person', selected: 'person.fill' }} />
      <NativeTabs.Trigger.Label>{getter('profileTitle')}</NativeTabs.Trigger.Label></NativeTabs.Trigger>
  </NativeTabs>;
}
