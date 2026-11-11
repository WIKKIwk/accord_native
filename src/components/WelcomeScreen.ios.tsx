import { Button, HStack, Image, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import { accessibilityIdentifier, background, buttonStyle, cornerRadius, font, foregroundStyle, frame, padding } from '@expo/ui/swift-ui/modifiers';
import { Animated } from 'react-native';
import { BaseHost as Host } from './BaseHost';
import { WelcomeLayout, type WelcomeScreenProps } from './WelcomeLayout';
import { useBaseTheme } from './useBaseTheme';

// @v2 WelcomeScreen
export function WelcomeScreen(props: WelcomeScreenProps) {
  const { colors } = useBaseTheme();
  return <WelcomeLayout content={props}>{(copy, opacity) => <Animated.View style={{ opacity }}>
    <Host matchContents={{ vertical: true }} style={{ width: '100%' }}>
      <VStack spacing={12}>
        <VStack spacing={2} modifiers={[cornerRadius(16)]}>{[
          { id: 'welcome-language', label: copy.languageLabel, value: copy.languageValue, onPress: props.onLanguage },
          { id: 'welcome-theme', label: copy.themeLabel, value: copy.themeValue, onPress: props.onTheme },
        ].map(item => <Button key={item.id} onPress={item.onPress} modifiers={[buttonStyle('plain'), accessibilityIdentifier(item.id)]}>
          <HStack spacing={16} modifiers={[padding({ horizontal: 18, vertical: 18 }), background(colors.surface), cornerRadius(4)]}>
            <Text modifiers={[font({ size: 20, textStyle: 'title3' }), foregroundStyle(colors.onSurface)]}>{item.label}</Text>
            <Spacer />
            <Text modifiers={[font({ size: 15, textStyle: 'subheadline' }), foregroundStyle(colors.onSurfaceVariant)]}>{item.value}</Text>
            <Image systemName="chevron.forward" size={12} color={colors.onSurfaceVariant} />
          </HStack>
        </Button>)}</VStack>
        <HStack modifiers={[padding({ top: 32 })]}>
          <Spacer />
          <Button onPress={props.onStart} modifiers={[buttonStyle('borderedProminent'), cornerRadius(27), accessibilityIdentifier('welcome-start')]}>
            <Text modifiers={[font({ size: 18, weight: 'semibold', textStyle: 'headline' }), frame({ minWidth: 108, minHeight: 38 })]}>{copy.startLabel}</Text>
          </Button>
        </HStack>
      </VStack>
    </Host>
  </Animated.View>}</WelcomeLayout>;
}
