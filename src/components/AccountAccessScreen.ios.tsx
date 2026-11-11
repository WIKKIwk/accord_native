import { Button, Image, NavigationStack, RNHostView, ScrollView, Text, Toolbar, ToolbarItem, VStack } from '@expo/ui/swift-ui';
import { accessibilityIdentifier, buttonStyle, font, foregroundStyle, frame, labelStyle, multilineTextAlignment, navigationBarTitleDisplayMode, navigationTitle, padding } from '@expo/ui/swift-ui/modifiers';
import { BaseHost as Host } from './BaseHost';
import { ProfileScreen } from './ProfileScreen';
import { WorkerProfileButton } from './WorkerProfileButton.ios';
import { useAccountAccess, type AccountAccessProps } from './useAccountAccess';

export function AccountAccessScreen({ session, onLogout }: AccountAccessProps) {
  const model = useAccountAccess(session);
  return <Host style={{ flex: 1 }}>
    <NavigationStack>
      <Toolbar modifiers={[navigationTitle(model.profileOpen ? model.text('profileTitle') : model.text('appTitle')), navigationBarTitleDisplayMode('inline')]}>
        {model.profileOpen ? <RNHostView><ProfileScreen session={session} onLogout={onLogout} showDirectLogout /></RNHostView>
          : <ScrollView>
            <VStack spacing={20} modifiers={[padding({ horizontal: 28, vertical: 64 }), frame({ maxWidth: Infinity })]}>
              <Image systemName={model.unassigned ? 'gearshape' : 'person.crop.circle.badge.exclamationmark'} size={56}
                modifiers={[foregroundStyle({ type: 'hierarchical', style: 'secondary' })]} />
              <Text modifiers={[font({ textStyle: 'title2', weight: 'semibold' }), multilineTextAlignment('center')]}>{model.title}</Text>
              <Text modifiers={[font({ textStyle: 'body' }), foregroundStyle({ type: 'hierarchical', style: 'secondary' }), multilineTextAlignment('center')]}>{model.message}</Text>
              <VStack spacing={12} modifiers={[padding({ top: 12 }), frame({ maxWidth: Infinity })]}>
                <Button onPress={model.openSwitcher} modifiers={[buttonStyle('borderedProminent'), accessibilityIdentifier('account-access-switch')]}>
                  <Text modifiers={[frame({ maxWidth: Infinity, minHeight: 38 })]}>{model.text('accountSwitchTitle')}</Text>
                </Button>
                <Button onPress={model.addAccount} modifiers={[buttonStyle('bordered'), accessibilityIdentifier('account-access-add')]}>
                  <Text modifiers={[frame({ maxWidth: Infinity, minHeight: 38 })]}>{model.text('accountAdd')}</Text>
                </Button>
              </VStack>
            </VStack>
          </ScrollView>}
        <Toolbar.Content>
          {model.profileOpen ? <ToolbarItem placement="topBarLeading">
            <Button systemImage="chevron.backward" label={model.text('closeAction')} onPress={model.closeProfile} modifiers={[labelStyle('iconOnly')]} />
          </ToolbarItem> : null}
          <ToolbarItem placement="topBarTrailing"><WorkerProfileButton session={session} onPress={model.openProfile} /></ToolbarItem>
        </Toolbar.Content>
      </Toolbar>
    </NavigationStack>
  </Host>;
}
