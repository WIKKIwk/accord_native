import { router, type Href } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RoleBottomBar } from '../shared/navigation/RoleBottomBar.android';
import { localizedGetter } from '../shared/localization';
import { useChatUnreadCount } from '../shared/chat/useChatUnreadCount';
import { useQolipRole } from './QolipRoleContext';
import { useQolipText } from './useQolipText';
export function QolipPickerDock({ beforeNavigate }: { beforeNavigate(): Promise<boolean> }) {
 const role=useQolipRole(), {text,locale}=useQolipText(), insets=useSafeAreaInsets(), unread=useChatUnreadCount(role.session);
 return <RoleBottomBar active="" bottomInset={insets.bottom} items={[{id:'',label:localizedGetter('homeNavTitle',locale),icon:'home'},
  {id:'products',label:text('nav.molds'),icon:'inventory_2'},{id:'tasks',label:text('nav.tasks'),icon:'task_alt'},{id:'chat',label:'Chat',icon:'chat_bubble',showBadge:unread>0}]}
  onSelect={id=>{void beforeNavigate().then(allowed=>{if(allowed&&role.isCurrent())router.dismissTo(('/android-qolip'+(id?'/'+id:''))as Href);});}}/>;
}
