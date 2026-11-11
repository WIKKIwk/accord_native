import { Button, HStack, Image, ProgressView, SecureField, Spacer, Text, VStack, useNativeState } from '@expo/ui/swift-ui';
import { accessibilityIdentifier, background, buttonBorderShape, buttonStyle, cornerRadius, disabled, font, foregroundStyle, frame, keyboardType, labelStyle, padding, textFieldStyle } from '@expo/ui/swift-ui/modifiers';
import { savedAccountDisplayName, savedAccountSubtitle } from '../shared/accountEntryLogic';
import { BaseHost as Host } from './BaseHost';
import { useAccountSwitcher, type AccountSwitcherProps } from './useAccountSwitcher';
import { useBaseTheme } from './useBaseTheme';

/** @v2 AccountSwitcherSheet */
export function AccountSwitcher(props: AccountSwitcherProps) {
  const model = useAccountSwitcher(useNativeState(''), props), { colors } = useBaseTheme();
  return <Host matchContents={{ vertical: true }} style={{ width: '100%' }}>
    <VStack alignment="leading" spacing={16} modifiers={[padding({ horizontal: 20, top: 8, bottom: 20 })]}>
      {model.target ? <>
        <Button label={model.text('closeAction')} systemImage="chevron.backward" onPress={model.back}
          modifiers={[labelStyle('iconOnly'), disabled(model.busy), accessibilityIdentifier('account-switch-back')]} />
        <Text modifiers={[font({ textStyle: 'title3' }), foregroundStyle(colors.onSurface)]}>{model.pinPrompt}</Text>
        <SecureField text={model.field} placeholder="PIN" maxLength={4} autoFocus onTextChange={model.changePin}
          modifiers={[keyboardType('ascii-capable-number-pad'), textFieldStyle('roundedBorder'), disabled(model.busy), accessibilityIdentifier('account-switch-pin')]} />
        <Button onPress={() => { void model.verify(model.field.get()); }}
          modifiers={[buttonStyle('borderedProminent'), disabled(model.busy), accessibilityIdentifier('account-switch-unlock')]}>
          <Text modifiers={[frame({ maxWidth: Infinity, minHeight: 38 })]}>{model.text(model.busy ? 'checking' : 'unlock')}</Text>
        </Button>
      </> : <>
        <Text modifiers={[font({ textStyle: 'title2', weight: 'semibold' }), foregroundStyle(colors.onSurface)]}>{model.text('accountSwitchTitle')}</Text>
        {model.loading ? <ProgressView /> : null}
        <VStack spacing={2} modifiers={[cornerRadius(16)]}>
          {model.accounts.map(account => {
            const current = account.id === model.activeId, name = savedAccountDisplayName(account);
            return <Button key={account.id} onPress={() => { void model.select(account); }}
              modifiers={[buttonStyle('plain'), disabled(model.busy), accessibilityIdentifier(`saved-account-${account.id}`)]}>
              <HStack spacing={12} modifiers={[padding({ horizontal: 16, vertical: 14 }),
                background(current ? colors.surfaceContainerHigh : colors.surfaceContainerLowest)]}>
                <Text modifiers={[font({ size: 20, weight: 'semibold' }), foregroundStyle(colors.onSecondaryContainer), frame({ width: 42, height: 42 }),
                  background(colors.secondaryContainer), cornerRadius(21)]}>{name.charAt(0).toUpperCase() || '?'}</Text>
                <VStack alignment="leading" spacing={4}>
                  <Text modifiers={[font({ size: 18, weight: 'semibold', textStyle: 'headline' }),
                    foregroundStyle(colors.onSurface)]}>{name}</Text>
                  <Text modifiers={[font({ textStyle: 'subheadline' }), foregroundStyle(colors.onSurfaceVariant ?? colors.onSurface)]}>{savedAccountSubtitle(account)}</Text>
                </VStack>
                <Spacer />
                {model.pins[account.id] ? <Image systemName="lock.fill" size={14} color={colors.onSurfaceVariant ?? colors.onSurface} /> : null}
                {current ? <Text modifiers={[font({ textStyle: 'caption', weight: 'semibold' }), foregroundStyle(colors.onSurface)]}>{model.text('accountCurrent')}</Text> : null}
              </HStack>
            </Button>;
          })}
        </VStack>
        <Button onPress={model.addAccount}
          modifiers={[buttonStyle('borderedProminent'), buttonBorderShape('capsule'), disabled(!model.ready || model.busy), accessibilityIdentifier('account-switch-add')]}>
          <HStack spacing={10} modifiers={[frame({ maxWidth: Infinity, minHeight: 40 })]}>
            <Image systemName="person.badge.plus" size={20} />
            <Text modifiers={[font({ size: 17, weight: 'semibold', textStyle: 'headline' })]}>{model.text('accountAdd')}</Text>
          </HStack>
        </Button>
      </>}
      {model.error ? <Text modifiers={[foregroundStyle(colors.error)]}>{model.error}</Text> : null}
    </VStack>
  </Host>;
}
