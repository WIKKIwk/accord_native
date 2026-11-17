import { Button, Host, HStack, Image, Text, VStack } from '@expo/ui/swift-ui';
import { buttonStyle, font, frame, padding } from '@expo/ui/swift-ui/modifiers';
import { router, type Href } from 'expo-router';
import { View, PlatformColor } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { localizedGetter } from '../shared/localization';
import { useChatUnreadCount } from '../shared/chat/useChatUnreadCount';
import { useQolipRole } from './QolipRoleContext';
import { useQolipText } from './useQolipText';
export function QolipPickerDock({ beforeNavigate }: { beforeNavigate(): Promise<boolean> }) {
 const role=useQolipRole(), {text,locale}=useQolipText(), insets=useSafeAreaInsets(), unread=useChatUnreadCount(role.session);
 const items=[{id:'',label:localizedGetter('homeNavTitle',locale),icon:'house' as const},{id:'products',label:text('nav.molds'),icon:'shippingbox' as const},
 {id:'tasks',label:text('nav.tasks'),icon:'checklist' as const},{id:'chat',label:'Chat',icon:'bubble.left' as const}];
 return <View style={{backgroundColor:PlatformColor('systemGroupedBackground'),paddingBottom:insets.bottom}}><Host matchContents={{vertical:true}}><HStack spacing={0}>
 {items.map(item=><Button key={item.id} onPress={()=>{void beforeNavigate().then(allowed=>{if(allowed&&role.isCurrent())router.dismissTo(('/ios-qolip'+(item.id?'/'+item.id:''))as Href);});}}
 modifiers={[buttonStyle('plain'),frame({maxWidth:Infinity,minHeight:56}),padding({vertical:8})]}><VStack spacing={4}><Image systemName={item.icon}/><Text modifiers={[font({size:11})]}>{item.label+(item.id==='chat'&&unread>0?' •':'')}</Text></VStack></Button>)}
 </HStack></Host></View>;
}
