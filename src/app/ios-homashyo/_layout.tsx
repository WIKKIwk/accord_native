import { NativeTabs } from 'expo-router/native-tabs';
import { RawSplitDrawer } from '../../homashyo/RawSplitDrawer';
import { RawSplitSessionGate } from '../../homashyo/RawSplitSessionGate';
import { usePreparationText } from '../../preparation/PreparationUI';
export default function Layout() {
  const t = usePreparationText();
  return <RawSplitSessionGate platform="ios"><RawSplitDrawer><NativeTabs disableHiddenAnimation>
    <NativeTabs.Trigger name="(home)"><NativeTabs.Trigger.Icon sf={{ default: 'scissors', selected: 'scissors' }} />
      <NativeTabs.Trigger.Label>{t('Rezka')}</NativeTabs.Trigger.Label></NativeTabs.Trigger>
    <NativeTabs.Trigger name="profile"><NativeTabs.Trigger.Icon sf={{ default: 'person', selected: 'person.fill' }} />
      <NativeTabs.Trigger.Label>{t('Profil')}</NativeTabs.Trigger.Label></NativeTabs.Trigger>
  </NativeTabs></RawSplitDrawer></RawSplitSessionGate>;
}
