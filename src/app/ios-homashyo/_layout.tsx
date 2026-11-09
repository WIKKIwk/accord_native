import { usePathname } from 'expo-router';
import { useRawSplitContext } from '../../homashyo/RawSplitContext';
import { NativeTabs } from 'expo-router/native-tabs';
import { RawSplitDrawer } from '../../homashyo/RawSplitDrawer';
import { RawSplitSessionGate } from '../../homashyo/RawSplitSessionGate';
import { usePreparationText } from '../../preparation/PreparationUI';
export default function Layout() {
  return <RawSplitSessionGate platform="ios"><RawSplitDrawer><RawSplitTabs /></RawSplitDrawer></RawSplitSessionGate>;
}
function RawSplitTabs() {
  const t = usePreparationText(), pathname = usePathname(), { unread, chatClosing } = useRawSplitContext();
  return <NativeTabs hidden={pathname.startsWith('/ios-homashyo/chat/') && !chatClosing} disableHiddenAnimation>
    <NativeTabs.Trigger name="(home)"><NativeTabs.Trigger.Icon sf={{ default: 'scissors', selected: 'scissors' }} />
      <NativeTabs.Trigger.Label>{t('Rezka')}</NativeTabs.Trigger.Label></NativeTabs.Trigger>
    <NativeTabs.Trigger name="profile"><NativeTabs.Trigger.Icon sf={{ default: 'person', selected: 'person.fill' }} />
      <NativeTabs.Trigger.Label>{t('Profil')}</NativeTabs.Trigger.Label></NativeTabs.Trigger>
    <NativeTabs.Trigger name="chat"><NativeTabs.Trigger.Icon sf={{ default: 'bubble.left', selected: 'bubble.left.fill' }} />
      <NativeTabs.Trigger.Label>{t('Chat')}</NativeTabs.Trigger.Label>
      <NativeTabs.Trigger.Badge hidden={unread <= 0}>{''}</NativeTabs.Trigger.Badge></NativeTabs.Trigger>
  </NativeTabs>;
}
