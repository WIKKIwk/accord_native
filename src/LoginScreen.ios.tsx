import { Button, HStack, Image, ProgressView, ScrollView, Text, TextField, VStack, useNativeState, type TextFieldRef } from '@expo/ui/swift-ui';
import { accessibilityIdentifier, accessibilityLabel, autocorrectionDisabled, background, buttonStyle, cornerRadius, disabled, font, foregroundStyle, frame, keyboardType, onSubmit, padding, scrollDismissesKeyboard, submitLabel, textContentType, textFieldStyle, textInputAutocapitalization } from '@expo/ui/swift-ui/modifiers';
import { useCallback, useRef } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { Session } from './auth';
import { AuthBackground } from './components/AuthBackground';
import { useLoginBackGesture } from './components/useLoginBackGesture';
import { useLoginScreen } from './components/useLoginScreen.ios';
import { BaseHost as Host } from './components/BaseHost';
import { useBaseTheme } from './components/useBaseTheme';

type Props = { onLogin: (session: Session) => void; onBack?: () => void; addAccountMode?: boolean };

// @v2 LoginScreen
export function LoginScreen({ onLogin, onBack, addAccountMode = false }: Props) {
  const form = useLoginScreen(onLogin, addAccountMode);
  const backGesture = useLoginBackGesture(onBack);
  const { colors } = useBaseTheme();
  const { height: screenHeight } = useWindowDimensions();
  const serverField = useNativeState(form.server);
  const phoneRef = useRef<TextFieldRef>(null);
  const codeRef = useRef<TextFieldRef>(null);
  const focusPhone = useCallback(() => { void phoneRef.current?.focus(); }, []);
  const focusCode = useCallback(() => { void codeRef.current?.focus(); }, []);
  // Expo's onSubmit only registers a native event; it never invokes these callbacks during render.
  // eslint-disable-next-line react-hooks/refs
  const serverNext = onSubmit(focusPhone);
  // eslint-disable-next-line react-hooks/refs
  const phoneNext = onSubmit(focusCode);
  const fieldModifiers = [textFieldStyle('plain'), font({ size: 17, textStyle: 'body' }), foregroundStyle(colors.onSurface),
    padding({ horizontal: 18, vertical: 17 }), background(colors.surface), cornerRadius(16),
    autocorrectionDisabled(), textInputAutocapitalization('never'), disabled(form.busy)];

  return <SafeAreaView {...backGesture.panHandlers} style={[styles.page, { backgroundColor: colors.surfaceContainerLow }]} edges={['top', 'bottom']}>
    <AuthBackground />
    <View style={styles.body}>
      <Host style={styles.page}>
        <VStack spacing={0} alignment="leading">
          {onBack ? <Button onPress={onBack} modifiers={[buttonStyle('plain'), accessibilityLabel(form.text('closeAction')),
            accessibilityIdentifier('login-back'), frame({ width: 48, height: 48 }), padding({ leading: 8, top: 4 })]}>
            <Image systemName="chevron.backward" size={22} color={colors.onSurface} />
          </Button> : null}
          <ScrollView showsIndicators={false} modifiers={[scrollDismissesKeyboard('interactively')]}>
            <VStack spacing={0} alignment="leading" modifiers={[padding({ horizontal: 24, top: screenHeight >= 760 ? 120 : 64, bottom: 32 }), frame({ maxWidth: Infinity, alignment: 'leading' })]}>
              <Text modifiers={[font({ size: 40, weight: 'regular', textStyle: 'largeTitle' }), foregroundStyle(colors.onSurface), padding({ bottom: 28 })]}>
                {form.text(addAccountMode ? 'addProfileTitle' : 'signInTitle')}
              </Text>
              <VStack spacing={16} modifiers={[frame({ maxWidth: Infinity })]}>
                <VStack alignment="leading" spacing={8}>
                  <Text modifiers={[font({ size: 13, textStyle: 'footnote' }), foregroundStyle(colors.onSurfaceVariant)]}>Server manzili</Text>
                  <TextField text={serverField} placeholder="Server manzili" onTextChange={form.setServer}
                    modifiers={[...fieldModifiers, keyboardType('url'), submitLabel('next'), serverNext, accessibilityLabel('Server manzili'), accessibilityIdentifier('login-server')]} />
                </VStack>
                <TextField ref={phoneRef} placeholder={form.text('phoneLabel')} onTextChange={form.setPhone}
                  modifiers={[...fieldModifiers, keyboardType('phone-pad'), textContentType('telephoneNumber'), submitLabel('next'),
                    phoneNext, accessibilityLabel(form.text('phoneLabel')), accessibilityIdentifier('login-phone')]} />
                <TextField ref={codeRef} text={form.codeField} placeholder={form.text('codeLabel')} onTextChange={form.changeCode}
                  modifiers={[...fieldModifiers, keyboardType(form.numericKeyboard ? 'numeric' : 'default'), submitLabel('done'),
                    onSubmit(() => { void form.submit(form.codeField.value); }), accessibilityLabel(form.text('codeLabel')), accessibilityIdentifier('login-code')]} />
              </VStack>
              {form.error ? <Text modifiers={[foregroundStyle(colors.error), padding({ top: 16 })]}>{form.error}</Text> : null}
              <Button onPress={() => { void form.submit(); }} modifiers={[buttonStyle('borderedProminent'), disabled(form.busy || !form.canSubmit),
                cornerRadius(27), accessibilityIdentifier('login-submit'), padding({ top: 24 })]}>
                <Text modifiers={[font({ size: 17, weight: 'semibold', textStyle: 'headline' }), frame({ maxWidth: Infinity, minHeight: 38 })]}>
                  {form.text(addAccountMode ? 'accountAdd' : 'loginAction')}
                </Text>
              </Button>
              {form.busy ? <HStack modifiers={[frame({ maxWidth: Infinity }), padding({ top: 16 })]}><ProgressView /></HStack> : null}
            </VStack>
          </ScrollView>
        </VStack>
      </Host>
    </View>
  </SafeAreaView>;
}

const styles = StyleSheet.create({ page: { flex: 1 }, body: { flex: 1, width: '100%', maxWidth: 444, alignSelf: 'center' } });
