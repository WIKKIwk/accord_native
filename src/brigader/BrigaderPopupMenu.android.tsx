import { DropdownMenu, DropdownMenuItem, IconButton, RNHostView } from '@expo/ui/jetpack-compose';
import { SymbolView } from 'expo-symbols';
import { semantics } from '@expo/ui/jetpack-compose/modifiers';
import { BaseHost } from '../components/BaseHost.android';
import { useBaseTheme } from '../components/useBaseTheme';
import { AdminText } from '../admin/AdminTypography.android';
export function BrigaderPopupMenu({ label,actions,disabled }: { label:string;actions:{ label:string;onPress:()=>void }[];disabled?:boolean }) {
  const { colors } = useBaseTheme();
  return <BaseHost matchContents><DropdownMenu><DropdownMenu.Trigger><IconButton enabled={!disabled} modifiers={[semantics({ contentDescription:label })]}><RNHostView matchContents><SymbolView name={{ android:'more_horiz' }} size={20} tintColor={colors.onSurfaceVariant} /></RNHostView></IconButton></DropdownMenu.Trigger><DropdownMenu.Items>{actions.map((action,index) => <DropdownMenuItem key={index} enabled={!disabled} onClick={action.onPress}><DropdownMenuItem.Text><AdminText>{action.label}</AdminText></DropdownMenuItem.Text></DropdownMenuItem>)}</DropdownMenu.Items></DropdownMenu></BaseHost>;
}
