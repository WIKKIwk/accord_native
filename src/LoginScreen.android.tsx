import { Button, Column, Host, OutlinedTextField, Text as ComposeText, useMaterialColors, useNativeState } from '@expo/ui/jetpack-compose';
import { fillMaxWidth, testID } from '@expo/ui/jetpack-compose/modifiers';
import { useState, useSyncExternalStore } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { login, type Session } from './auth';
import { MobileApi } from './mobileApi';
import { loginCodeUsesNumericKeyboard, loginFailureMessage } from './shared/loginLogic';
import { localizedGetter } from './shared/localization';
import { localeController } from './shared/localization/runtime';

type Props = { onLogin: (session: Session) => void };

const subscribeLocale = (listener: () => void) => localeController.addListener(listener);
const currentLocale = () => localeController.locale;

// @v2 LoginScreen
export function LoginScreen({ onLogin }: Props) {
  const locale = useSyncExternalStore(subscribeLocale, currentLocale, currentLocale);
  const t = (key: string) => localizedGetter(key, locale);
  const colors = useMaterialColors();
  const [server, setServer] = useState(MobileApi.instance.baseUrl);
  const serverField = useNativeState(MobileApi.instance.baseUrl);
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit() {
    if (busy) return;
    setBusy(true); setError('');
    try { onLogin(await login(server, phone, code)); }
    catch (e) { setError(loginFailureMessage(e, { loginConnectionFailed: t('loginConnectionFailed'), loginFailed: t('loginFailed') })); }
    finally { setBusy(false); }
  }

  return <SafeAreaView edges={['top', 'bottom']} style={[styles.page, { backgroundColor: colors.surfaceContainerLow }]}>
    <KeyboardAvoidingView style={styles.page}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={[styles.brand, { backgroundColor: colors.primary }]}><Text style={[styles.brandText, { color: colors.onPrimary }]}>A</Text></View>
        <Text style={[styles.title, { color: colors.onSurface }]}>Accord</Text>
        <Text style={[styles.subtitle, { color: colors.onSurfaceVariant }]}>Ish joyingizga xush kelibsiz</Text>
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.outlineVariant }]}>
          <Text style={[styles.cardTitle, { color: colors.onSurface }]}>{t('signInTitle')}</Text>
          <Text style={[styles.hint, { color: colors.onSurfaceVariant }]}>Telefon raqamingiz va kirish kodingizni kiriting.</Text>
          <Host matchContents={{ vertical: true }} style={styles.host}>
            <Column verticalArrangement={{ spacedBy: 14 }}>
              <OutlinedTextField value={serverField} singleLine enabled={!busy} onValueChange={setServer} keyboardOptions={{ keyboardType: 'uri', autoCorrectEnabled: false }}
                modifiers={[fillMaxWidth()]}><OutlinedTextField.Label><ComposeText>Server manzili</ComposeText></OutlinedTextField.Label></OutlinedTextField>
              <OutlinedTextField singleLine enabled={!busy} onValueChange={setPhone} keyboardOptions={{ keyboardType: 'phone', imeAction: 'next' }}
                modifiers={[fillMaxWidth()]}><OutlinedTextField.Label><ComposeText>{t('phoneLabel')}</ComposeText></OutlinedTextField.Label></OutlinedTextField>
              <OutlinedTextField singleLine enabled={!busy} onValueChange={setCode} keyboardOptions={{ keyboardType: loginCodeUsesNumericKeyboard(code) ? 'number' : 'text', autoCorrectEnabled: false, imeAction: 'done' }}
                modifiers={[fillMaxWidth()]}>
                <OutlinedTextField.Label><ComposeText>{t('codeLabel')}</ComposeText></OutlinedTextField.Label></OutlinedTextField>
              <Button enabled={!busy && !!phone.trim() && !!code.trim()} onClick={() => { void submit(); }}
                modifiers={[fillMaxWidth(), testID('login-submit')]}><ComposeText>{t('loginAction')}</ComposeText></Button>
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
