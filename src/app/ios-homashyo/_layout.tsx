import { usePathname } from 'expo-router';
import { useRawSplitContext } from '../../homashyo/RawSplitContext';
import { RoleTabs, roleTabIcons } from '../../shared/navigation/RoleTabs.ios';
import { RawSplitDrawer } from '../../homashyo/RawSplitDrawer';
import { RawSplitSessionGate } from '../../homashyo/RawSplitSessionGate';
import { usePreparationText } from '../../preparation/PreparationUI';
export default function Layout() {
  return <RawSplitSessionGate platform="ios"><RawSplitDrawer><RawSplitTabs /></RawSplitDrawer></RawSplitSessionGate>;
}
function RawSplitTabs() {
  const t = usePreparationText(), pathname = usePathname(), { unread, chatClosing } = useRawSplitContext();
  return <RoleTabs hidden={pathname.startsWith('/ios-homashyo/chat/') && !chatClosing} disableHiddenAnimation tabs={[
    { name: '(home)', label: t('Rezka'), icon: 'scissors' },
    { name: 'profile', label: t('Profil'), icon: roleTabIcons.profile },
    { name: 'chat', label: t('Chat'), icon: roleTabIcons.chat, showBadge: unread > 0 },
  ]} />;
}
