import { usePathname } from 'expo-router';
import { useBoyoqchiContext } from '../../../boyoqchi/BoyoqchiContext';
import { RoleTabs, roleTabIcons } from '../../../shared/navigation/RoleTabs.ios';
import { useBoyoqchiGetter, useBoyoqchiText } from '../../../boyoqchi/useBoyoqchiText';
export default function BoyoqchiTabs() {
  const getter = useBoyoqchiGetter(), t = useBoyoqchiText();
  const pathname = usePathname(), { unread, chatClosing } = useBoyoqchiContext();
  return <RoleTabs hidden={pathname.startsWith('/ios-boyoqchi/chat/') && !chatClosing} disableHiddenAnimation tabs={[
    { name: '(home)', label: getter('homeNavTitle'), icon: roleTabIcons.home },
    { name: '(astatka)', label: t('Astatka'), icon: { default: 'shippingbox', selected: 'shippingbox.fill' } },
    { name: 'profile', label: getter('profileTitle'), icon: roleTabIcons.profile },
    { name: 'chat', label: t('Chat'), icon: roleTabIcons.chat, showBadge: unread > 0 },
  ]} />;
}
