import { Button, Column, FieldGroup, Host, Text as ExpoText, TextInput } from '@expo/ui';
import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, PlatformColor, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { login, type Session } from './auth';
import { MobileApi } from './mobileApi';

type Props = { onLogin: (session: Session) => void; onBack?: () => void; addAccountMode?: boolean };

export function LoginScreen({ onLogin }: Props) {
  const [server, setServer] = useState(MobileApi.instance.baseUrl);
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit() {
    if (busy) return;
    setBusy(true); setError('');
    try { onLogin(await login(server, phone, code)); }
    catch (e) { setError(e instanceof Error ? e.message : 'Kirish amalga oshmadi.'); }
    finally { setBusy(false); }
  }

  if (Platform.OS === 'ios') {
    return <SafeAreaView style={[styles.iosPage, { backgroundColor: PlatformColor('systemGroupedBackground') }]} edges={['top', 'bottom']}>
      <Host style={styles.iosPage}>
        <FieldGroup>
          <FieldGroup.Section>
            <ExpoText textStyle={{ fontSize: 28, fontWeight: '700' }}>Accord</ExpoText>
            <ExpoText>Ish joyingizga xush kelibsiz</ExpoText>
          </FieldGroup.Section>
          <FieldGroup.Section title="Server">
            <TextInput defaultValue={server} accessibilityLabel="Server manzili" placeholder="Server manzili" keyboardType="url" autoCapitalize="none" autoCorrect={false} onChangeText={setServer} editable={!busy} />
          </FieldGroup.Section>
          <FieldGroup.Section title="Hisobga kirish">
            <TextInput accessibilityLabel="Telefon raqam" placeholder="Telefon raqam" keyboardType="phone-pad" autoComplete="tel" onChangeText={setPhone} editable={!busy} />
            <TextInput accessibilityLabel="Kirish kodi" placeholder="Kirish kodi" keyboardType="number-pad" secureTextEntry onChangeText={setCode} editable={!busy} />
          </FieldGroup.Section>
          <FieldGroup.Section>
            <Button label={busy ? 'Kirilmoqda…' : 'Kirish'} disabled={busy || !phone.trim() || !code.trim()} onPress={submit} />
            {!!error && <ExpoText textStyle={{ color: '#b3261e' }}>{error}</ExpoText>}
          </FieldGroup.Section>
        </FieldGroup>
      </Host>
    </SafeAreaView>;
  }

  return (
    <KeyboardAvoidingView style={styles.page}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.brand}><Text style={styles.brandText}>A</Text></View>
        <Text style={styles.title}>Accord</Text>
        <Text style={styles.subtitle}>Ish joyingizga xush kelibsiz</Text>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Hisobga kirish</Text>
          <Text style={styles.hint}>Telefon raqamingiz va kirish kodingizni kiriting.</Text>
          <Host matchContents={{ vertical: true }} style={styles.host}>
            <Column spacing={14}>
              <TextInput defaultValue={server} placeholder="Server manzili" keyboardType="url" autoCapitalize="none" autoCorrect={false} onChangeText={setServer} editable={!busy} />
              <TextInput placeholder="Telefon raqam" keyboardType="phone-pad" autoComplete="tel" onChangeText={setPhone} editable={!busy} />
              <TextInput placeholder="Kirish kodi" keyboardType="number-pad" secureTextEntry onChangeText={setCode} editable={!busy} />
              <Button label={busy ? 'Kirilmoqda…' : 'Kirish'} variant="filled" disabled={busy || !phone.trim() || !code.trim()} onPress={submit} />
            </Column>
          </Host>
          {busy ? <ActivityIndicator color="#284c3d" style={styles.spinner} /> : null}
          {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
        </View>
        <Text style={styles.footer}>ACCORD · Ishlab chiqarish tizimi</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  iosPage: { flex: 1 },
  page: { flex: 1, backgroundColor: '#f4f6f3' },
  content: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24, paddingVertical: 42 },
  brand: { width: 58, height: 58, borderRadius: 19, backgroundColor: '#294e3e', alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  brandText: { fontSize: 30, fontWeight: '800', color: '#fff' },
  title: { fontSize: 34, fontWeight: '700', color: '#162a20', letterSpacing: -1 },
  subtitle: { color: '#627269', fontSize: 15, marginTop: 5, marginBottom: 30 },
  card: { backgroundColor: '#fff', borderRadius: 24, padding: 22, borderWidth: 1, borderColor: '#e5ebe5' },
  cardTitle: { fontSize: 21, fontWeight: '700', color: '#172b20' },
  hint: { marginTop: 6, marginBottom: 22, fontSize: 14, lineHeight: 20, color: '#68786e' },
  host: { width: '100%' },
  spinner: { marginTop: 12 },
  error: { color: '#b3261e', marginTop: 14, fontSize: 14, lineHeight: 20 },
  footer: { fontSize: 11, letterSpacing: 1, fontWeight: '600', color: '#9aa79e', marginTop: 30, textAlign: 'center' },
});
