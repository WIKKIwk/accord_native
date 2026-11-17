import { Button, Image, Menu } from '@expo/ui/swift-ui';
import { accessibilityLabel, disabled as inactive, frame } from '@expo/ui/swift-ui/modifiers';
import { BaseHost } from '../components/BaseHost.ios';
export function BrigaderPopupMenu({ label,actions,disabled }: { label:string;actions:{ label:string;onPress:()=>void }[];disabled?:boolean }) {
  return <BaseHost matchContents><Menu label={<Image systemName="ellipsis" />} modifiers={[inactive(!!disabled),accessibilityLabel(label),frame({ minWidth:44,minHeight:44 })]}>{actions.map((action,index) => <Button key={index} label={action.label} onPress={action.onPress} />)}</Menu></BaseHost>;
}
