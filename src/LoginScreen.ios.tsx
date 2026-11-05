import { Button, FieldGroup, Host, Text as ExpoText, TextInput } from '@expo/ui';
import { ActivityIndicator, PlatformColor, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { Session } from './auth';
import { useLoginScreen } from './components/useLoginScreen.ios';

type Props = { onLogin: (session: Session) => void; onBack?: () => void; addAccountMode?: boolean };

// @v2 LoginScreen
export function LoginScreen({ onLogin, onBack, addAccountMode = false }: Props) {
  const form = useLoginScreen(onLogin, addAccountMode);
  return <SafeAreaView style={[styles.page, { backgroundColor: PlatformColor('systemGroupedBackground') }]} edges={['top', 'bottom']}>
    <Host style={styles.page}>
      <FieldGroup>
        <FieldGroup.Section>
          {onBack ? <Button label={form.text('closeAction')} disabled={form.busy} onPress={onBack} /> : null}
          <ExpoText textStyle={{ fontSize: 28, fontWeight: '700' }}>Accord</ExpoText>
          <ExpoText>{form.text(addAccountMode ? 'addProfileTitle' : 'signInTitle')}</ExpoText>
        </FieldGroup.Section>
        <FieldGroup.Section title="Server">
          <TextInput defaultValue={form.server} accessibilityLabel="Server manzili" placeholder="Server manzili" keyboardType="url"
            autoCapitalize="none" autoCorrect={false} onChangeText={form.setServer} editable={!form.busy} />
        </FieldGroup.Section>
        <FieldGroup.Section title={form.text(addAccountMode ? 'addProfileTitle' : 'signInTitle')}>
          <TextInput accessibilityLabel={form.text('phoneLabel')} placeholder={form.text('phoneLabel')} keyboardType="phone-pad"
            autoComplete="tel" onChangeText={form.setPhone} editable={!form.busy} />
          <TextInput value={form.codeField} accessibilityLabel={form.text('codeLabel')} placeholder={form.text('codeLabel')}
            keyboardType={form.numericKeyboard ? 'number-pad' : 'default'} autoCapitalize="none" autoCorrect={false}
            onChangeText={form.changeCode} onSubmitEditing={() => { void form.submit(); }} editable={!form.busy} />
        </FieldGroup.Section>
        <FieldGroup.Section>
          <Button label={form.text(addAccountMode ? 'accountAdd' : 'loginAction')} disabled={form.busy || !form.canSubmit}
            onPress={() => { void form.submit(); }} />
          {!!form.error && <ExpoText textStyle={{ color: '#b3261e' }}>{form.error}</ExpoText>}
        </FieldGroup.Section>
      </FieldGroup>
    </Host>
    {form.busy ? <ActivityIndicator accessibilityLabel={form.text('checking')} style={styles.spinner} /> : null}
  </SafeAreaView>;
}

const styles = StyleSheet.create({ page: { flex: 1 }, spinner: { marginBottom: 16 } });
