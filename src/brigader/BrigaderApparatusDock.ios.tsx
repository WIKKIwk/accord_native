import { Button, HStack, Image, Text, VStack } from '@expo/ui/swift-ui';
import { accessibilityAddTraits, background, buttonStyle, font, foregroundStyle, frame, padding } from '@expo/ui/swift-ui/modifiers';
import { BaseHost } from '../components/BaseHost.ios';
import { useBaseTheme } from '../components/useBaseTheme';
import { useAdminShellLayout } from '../admin/useAdminShellLayout';
import { BrigaderPrimaryAction } from './BrigaderPrimaryAction';
import { useBrigaderApparatusDock } from './useBrigaderApparatusDock';
import type { AdminMenuAction } from '../admin/adminCreateMenuController';
export function BrigaderApparatusDock({ primary = true,actions,active = '',beforeNavigate }: { primary?:boolean;actions?:readonly AdminMenuAction[];active?:string;beforeNavigate?:(navigate:()=>void)=>void }) {
  const model = useBrigaderApparatusDock(), { colors } = useBaseTheme(), layout = useAdminShellLayout(true);
  if (layout.dockBottomInset === null) return null;
  return <>{primary ? <BrigaderPrimaryAction isCurrent={model.page.current} canInteract={model.page.interactive} actions={actions ?? model.actions} /> : null}<BaseHost matchContents={{ vertical:true }} style={{ width:'100%' }}><HStack spacing={0} modifiers={[frame({ maxWidth:Infinity,minHeight:60 }),padding({ bottom:layout.dockBottomInset }),background(colors.surfaceContainerHigh),accessibilityAddTraits(['isTabBar'])]}>{model.items.map(item => <Button key={item.id} onPress={() => { if (item.id !== active) { if (beforeNavigate) beforeNavigate(() => model.open(item.route)); else model.open(item.route); } }} modifiers={[buttonStyle('plain'),frame({ maxWidth:Infinity,minHeight:60 })]}><VStack spacing={4} modifiers={[foregroundStyle(active === item.id ? colors.primary : colors.onSurfaceVariant)]}><Image systemName={item.id === 'home' ? 'house' : 'person'} size={23} /><Text modifiers={[font({ textStyle:'caption2' })]}>{item.label}</Text></VStack></Button>)}</HStack></BaseHost></>;
}

/** Keeps the queue scanner callback and the genuine source create-menu owner. */
export function BrigaderApparatusPrimary({ scan }: { scan: () => void }) {
  const model = useBrigaderApparatusDock();
  return <BrigaderPrimaryAction isCurrent={model.page.current} canInteract={model.page.interactive} actions={model.actions.map(action => action.id === 'scan' ? { ...action, onPress: scan } : action)} />;
}
