import { Button, Column, Host, OutlinedTextField, Text as ComposeText, useMaterialColors, useNativeState } from '@expo/ui/jetpack-compose';
import { fillMaxWidth, testID } from '@expo/ui/jetpack-compose/modifiers';
import { useEffect } from 'react';
import { ActivityIndicator, BackHandler, KeyboardAvoidingView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { Session } from './auth';
import { useLoginForm } from './components/useLoginForm';
import { useLoginBackGesture } from './components/useLoginBackGesture';

type Props = { onLogin: (session: Session) => void; onBack?: () => void; addAccountMode?: boolean };

// @v2 LoginScreen
export function LoginScreen({ onLogin, onBack, addAccountMode = false }: Props) {
  const form = useLoginForm(onLogin, addAccountMode);
  const { text: t, busy, error } = form;
  const colors = useMaterialColors();
  const serverField = useNativeState(form.server);
  const codeField = useNativeState('');
  const backGesture = useLoginBackGesture(onBack);
  useEffect(() => {
    if (!onBack) return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => { onBack(); return true; });
    return () => subscription.remove();
  }, [onBack]);

  return <SafeAreaView {...backGesture.panHandlers} edges={['top', 'bottom']} style={[styles.page, { backgroundColor: colors.surfaceContainerLow }]}>
    <KeyboardAvoidingView style={styles.page}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={[styles.brand, { backgroundColor: colors.primary }]}><Text style={[styles.brandText, { color: colors.onPrimary }]}>A</Text></View>
        <Text style={[styles.title, { color: colors.onSurface }]}>Accord</Text>
        <Text style={[styles.subtitle, { color: colors.onSurfaceVariant }]}>Ish joyingizga xush kelibsiz</Text>
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.outlineVariant }]}>
          {onBack ? <Text accessibilityRole="button" onPress={onBack} style={{ color: colors.primary }}>{t('closeAction')}</Text> : null}
          <Text style={[styles.cardTitle, { color: colors.onSurface }]}>{t(addAccountMode ? 'addProfileTitle' : 'signInTitle')}</Text>
          <Text style={[styles.hint, { color: colors.onSurfaceVariant }]}>Telefon raqamingiz va kirish kodingizni kiriting.</Text>
          <Host matchContents={{ vertical: true }} style={styles.host}>
            <Column verticalArrangement={{ spacedBy: 14 }}>
              <OutlinedTextField value={serverField} singleLine enabled={!busy} onValueChange={form.setServer} keyboardOptions={{ keyboardType: 'uri', autoCorrectEnabled: false }}
                modifiers={[fillMaxWidth()]}><OutlinedTextField.Label><ComposeText>Server manzili</ComposeText></OutlinedTextField.Label></OutlinedTextField>
              <OutlinedTextField singleLine enabled={!busy} onValueChange={form.setPhone} keyboardOptions={{ keyboardType: 'phone', imeAction: 'next' }}
                modifiers={[fillMaxWidth()]}><OutlinedTextField.Label><ComposeText>{t('phoneLabel')}</ComposeText></OutlinedTextField.Label></OutlinedTextField>
              <OutlinedTextField value={codeField} singleLine enabled={!busy} onValueChange={value => {
                const next = form.changeCode(value); if (next !== value) codeField.set(next);
              }} keyboardOptions={{ keyboardType: form.numericKeyboard ? 'number' : 'text', autoCorrectEnabled: false, imeAction: 'done' }}
                keyboardActions={{ onDone: value => { void form.submit(value); } }}
                modifiers={[fillMaxWidth()]}>
                <OutlinedTextField.Label><ComposeText>{t('codeLabel')}</ComposeText></OutlinedTextField.Label></OutlinedTextField>
              <Button enabled={!busy && form.canSubmit} onClick={() => { void form.submit(); }}
                modifiers={[fillMaxWidth(), testID('login-submit')]}><ComposeText>{t(addAccountMode ? 'accountAdd' : 'loginAction')}</ComposeText></Button>
            </Column>
          </Host>
          {busy ? <ActivityIndicator color={colors.primary} style={styles.spinner} /> : null}
          {error ? <Text accessibilityRole="alert" style={[styles.error, { color: colors.error }]}>{error}</Text> : null}
        </View>
        <Text style={[styles.footer, { color: colors.onSurfaceVariant }]}>ACCORD · Ishlab chiqarish tizimi</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  content: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24, paddingVertical: 42 },
  brand: { width: 58, height: 58, borderRadius: 19, alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  brandText: { fontSize: 30, fontWeight: '800' },
  title: { fontSize: 34, fontWeight: '700', letterSpacing: -1 },
  subtitle: { fontSize: 15, marginTop: 5, marginBottom: 30 },
  card: { borderRadius: 24, padding: 22, borderWidth: 1 },
  cardTitle: { fontSize: 21, fontWeight: '700' },
  hint: { marginTop: 6, marginBottom: 22, fontSize: 14, lineHeight: 20 },
  host: { width: '100%' },
  spinner: { marginTop: 12 },
  error: { marginTop: 14, fontSize: 14, lineHeight: 20 },
  footer: { fontSize: 11, letterSpacing: 1, fontWeight: '600', marginTop: 30, textAlign: 'center' },
});
