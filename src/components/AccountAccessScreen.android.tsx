import { Button, Column, Icon, OutlinedButton, Text } from '@expo/ui/jetpack-compose';
import { fillMaxWidth, height, testID } from '@expo/ui/jetpack-compose/modifiers';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { RoleHeader } from '../shared/navigation/RoleHeader.android';
import { RoleHeaderButton } from '../shared/navigation/RoleHeaderButton';
import { BaseHost as Host } from './BaseHost';
import { ProfileScreen } from './ProfileScreen';
import { useAccountAccess, type AccountAccessProps } from './useAccountAccess';
import { useBaseTheme } from './useBaseTheme';

export function AccountAccessScreen({ session, onLogout }: AccountAccessProps) {
  const model = useAccountAccess(session), { colors } = useBaseTheme();
  return <SafeAreaView style={{ flex: 1, backgroundColor: colors.surfaceContainerLow }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingRight: 16 }}>
      <View style={{ flex: 1 }}><RoleHeader title={model.text(model.profileOpen ? 'profileTitle' : 'appTitle')}
        navigation={model.profileOpen ? { icon: 'back', label: model.text('closeAction'), onPress: model.closeProfile } : undefined} /></View>
      <RoleHeaderButton icon="profile" label={model.text('profileTitle')} onPress={model.openProfile} tintColor={colors.onSurface} testID="header-profile" />
    </View>
    {model.profileOpen ? <ProfileScreen session={session} onLogout={onLogout} showDirectLogout />
      : <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 28 }}>
        <Host matchContents={{ vertical: true }} style={{ width: '100%' }}>
          <Column horizontalAlignment="center" verticalArrangement={{ spacedBy: 20 }} modifiers={[fillMaxWidth()]}>
            <Icon source={require('../../assets/icons/navigation/outlined/person.xml')} size={56} tint={colors.onSurfaceVariant ?? colors.onSurface} />
            <Text color={colors.onSurface} style={{ typography: 'headlineSmall', textAlign: 'center' }}>{model.title}</Text>
            <Text color={colors.onSurfaceVariant ?? colors.onSurface} style={{ typography: 'bodyLarge', textAlign: 'center' }}>{model.message}</Text>
            <Button onClick={model.openSwitcher} modifiers={[fillMaxWidth(), height(56), testID('account-access-switch')]}>
              <Text>{model.text('accountSwitchTitle')}</Text>
            </Button>
            <OutlinedButton onClick={model.addAccount} modifiers={[fillMaxWidth(), height(56), testID('account-access-add')]}>
              <Text>{model.text('accountAdd')}</Text>
            </OutlinedButton>
          </Column>
        </Host>
      </ScrollView>}
  </SafeAreaView>;
}
