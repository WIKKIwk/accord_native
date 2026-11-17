import { useQolipPageHeaderValue } from './QolipPageHeaderContext';
import { Button, Host } from '@expo/ui/swift-ui';
import { labelStyle, disabled } from '@expo/ui/swift-ui/modifiers';
import { Stack } from 'expo-router';
import type { ReactNode } from 'react';
import { View, PlatformColor } from 'react-native';
import { RoleDrawerButton } from '../shared/navigation/RoleDrawerButton';
import { WorkerProfileButton } from '../components/WorkerProfileButton.ios';
import { BaseHost } from '../components/BaseHost';
import { useQolipRole } from './QolipRoleContext';
import { useQolipText } from './useQolipText';
export function QolipPage({ title, children, ownHeader = false, onBack }: { title: string; children: ReactNode; ownHeader?: boolean; back?: boolean; onBack?: () => void }) {
  const role = useQolipRole(), header = useQolipPageHeaderValue(), { text } = useQolipText();
  return <><Stack.Screen options={{ title, gestureEnabled: !onBack, headerShown: !ownHeader, headerLeft: ({ canGoBack }) => onBack ? <Host matchContents><Button label={text('action.back')} systemImage="chevron.left" onPress={onBack} modifiers={[labelStyle('iconOnly')]} /></Host> : canGoBack ? undefined : <RoleDrawerButton label={title} /> }} />
    {!ownHeader && <Stack.Toolbar placement="right"><Stack.Toolbar.View><Host matchContents>{header?.actions.map(action => <Button key={action.id} label={action.label} systemImage={action.symbol} onPress={() => { if(role.isCurrent()) header.onSelect(action.id); }} modifiers={[labelStyle('iconOnly'), disabled(!!action.disabled)]} />)}</Host></Stack.Toolbar.View>{!header?.hideProfile && <Stack.Toolbar.View><BaseHost matchContents><WorkerProfileButton session={role.session} onPress={role.onProfile} /></BaseHost></Stack.Toolbar.View>}</Stack.Toolbar>}
    <View style={{ flex: 1, backgroundColor: PlatformColor('systemGroupedBackground') }}>{children}</View></>;
}
