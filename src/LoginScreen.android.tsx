import { Button, CircularProgressIndicator, Column, Icon, IconButton, OutlinedTextField, Row, Shape, Spacer, Text, useNativeState, type TextFieldRef } from '@expo/ui/jetpack-compose';
import { fillMaxSize, fillMaxWidth, height, padding, size, testID, verticalScroll, weight } from '@expo/ui/jetpack-compose/modifiers';
import { useEffect, useRef } from 'react';
import { BackHandler, StyleSheet, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { Session } from './auth';
import { AuthBackground } from './components/AuthBackground';
import { useLoginForm } from './components/useLoginForm';
import { useLoginBackGesture } from './components/useLoginBackGesture';
import { BaseHost as Host } from './components/BaseHost';
import { useBaseTheme } from './components/useBaseTheme';

type Props = { onLogin: (session: Session) => void; onBack?: () => void; addAccountMode?: boolean };

// @v2 LoginScreen
export function LoginScreen({ onLogin, onBack, addAccountMode = false }: Props) {
  const form = useLoginForm(onLogin, addAccountMode);
  const { text: t, busy, error } = form;
  const { colors } = useBaseTheme();
  const { height: screenHeight } = useWindowDimensions();
  const serverField = useNativeState(form.server);
  const codeField = useNativeState('');
  const phoneRef = useRef<TextFieldRef>(null);
  const codeRef = useRef<TextFieldRef>(null);
  const backGesture = useLoginBackGesture(onBack);
  const fieldColors = { focusedContainerColor: colors.surface, unfocusedContainerColor: colors.surface,
    focusedTextColor: colors.onSurface, unfocusedTextColor: colors.onSurface,
    focusedLabelColor: colors.primary, unfocusedLabelColor: colors.onSurfaceVariant,
    focusedIndicatorColor: colors.primary, unfocusedIndicatorColor: colors.outlineVariant };
  const fieldShape = Shape.RoundedCorner({ cornerRadii: { topStart: 18, topEnd: 18, bottomStart: 18, bottomEnd: 18 } });
  useEffect(() => {
    if (!onBack) return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => { onBack(); return true; });
    return () => subscription.remove();
  }, [onBack]);

  return <SafeAreaView {...backGesture.panHandlers} edges={['top', 'bottom']} style={[styles.page, { backgroundColor: colors.surfaceContainerLow }]}>
    <AuthBackground />
    <View style={styles.body}>
      <Host style={styles.page}>
        <Column modifiers={[fillMaxSize()]}>
          {onBack ? <Row modifiers={[fillMaxWidth(), padding(12, 4, 12, 4)]}>
            <IconButton onClick={onBack} modifiers={[testID('login-back')]}>
              <Icon source={require('../assets/icons/gscale/arrow_back.xml')} contentDescription={t('closeAction')} tint={colors.onSurface} size={24} />
            </IconButton>
          </Row> : null}
          <Column modifiers={[weight(1), fillMaxWidth(), verticalScroll(), padding(24, 0, 24, 32)]}>
            <Spacer modifiers={[height(screenHeight >= 760 ? 120 : 64)]} />
            <Text color={colors.onSurface} style={{ fontSize: 40, fontWeight: '400', letterSpacing: -1.4 }}>
              {t(addAccountMode ? 'addProfileTitle' : 'signInTitle')}
            </Text>
            <Spacer modifiers={[height(28)]} />
            <Column verticalArrangement={{ spacedBy: 16 }} modifiers={[fillMaxWidth()]}>
              <OutlinedTextField value={serverField} singleLine enabled={!busy} colors={fieldColors} shape={fieldShape} onValueChange={form.setServer}
                keyboardOptions={{ keyboardType: 'uri', autoCorrectEnabled: false, imeAction: 'next' }} keyboardActions={{ onNext: () => { void phoneRef.current?.focus(); } }}
                modifiers={[fillMaxWidth(), testID('login-server')]}>
                <OutlinedTextField.Label><Text>Server manzili</Text></OutlinedTextField.Label>
              </OutlinedTextField>
              <OutlinedTextField ref={phoneRef} singleLine enabled={!busy} colors={fieldColors} shape={fieldShape} onValueChange={form.setPhone}
                keyboardOptions={{ keyboardType: 'phone', autoCorrectEnabled: false, imeAction: 'next' }} keyboardActions={{ onNext: () => { void codeRef.current?.focus(); } }}
                modifiers={[fillMaxWidth(), testID('login-phone')]}>
                <OutlinedTextField.Label><Text>{t('phoneLabel')}</Text></OutlinedTextField.Label>
              </OutlinedTextField>
              <OutlinedTextField ref={codeRef} value={codeField} singleLine enabled={!busy} colors={fieldColors} shape={fieldShape}
                onValueChange={value => { const next = form.changeCode(value); if (next !== value) codeField.set(next); }}
                keyboardOptions={{ keyboardType: form.numericKeyboard ? 'number' : 'text', autoCorrectEnabled: false, imeAction: 'done' }}
                keyboardActions={{ onDone: value => { void form.submit(value); } }} modifiers={[fillMaxWidth(), testID('login-code')]}>
                <OutlinedTextField.Label><Text>{t('codeLabel')}</Text></OutlinedTextField.Label>
              </OutlinedTextField>
            </Column>
            {error ? <Text color={colors.error} modifiers={[padding(0, 16, 0, 0)]}>{error}</Text> : null}
            <Spacer modifiers={[height(24)]} />
            <Button enabled={!busy && form.canSubmit} onClick={() => { void form.submit(); }} modifiers={[fillMaxWidth(), height(54), testID('login-submit')]}>
              <Text style={{ fontSize: 17, fontWeight: '600' }}>{t(addAccountMode ? 'accountAdd' : 'loginAction')}</Text>
            </Button>
            {busy ? <Row modifiers={[fillMaxWidth(), padding(0, 16, 0, 0)]} horizontalArrangement="center">
              <CircularProgressIndicator modifiers={[size(24, 24)]} />
            </Row> : null}
          </Column>
        </Column>
      </Host>
    </View>
  </SafeAreaView>;
}

const styles = StyleSheet.create({ page: { flex: 1 }, body: { flex: 1, width: '100%', maxWidth: 444, alignSelf: 'center' } });
