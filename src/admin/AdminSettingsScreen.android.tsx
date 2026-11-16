import { Button, CircularProgressIndicator, Column, ListItem, OutlinedTextField, RNHostView, Row, Shape, SnackbarHost, Spacer, Text, TextButton,
  useMaterialColors, useNativeState, type SnackbarHostRef } from '@expo/ui/jetpack-compose';
import { combinedClickable, fillMaxSize, fillMaxWidth, height, padding, size, testID, verticalScroll } from '@expo/ui/jetpack-compose/modifiers';
import { SymbolView } from 'expo-symbols';
import { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BaseHost } from '../components/BaseHost.android';
import { appRoutes } from '../shared/appRoutes';
import { RoleHeader } from '../shared/navigation/RoleHeader.android';
import { adminSettingsFieldLabels, adminSettingsFieldNames, type AdminSettingsField } from './adminSettingsController';
import type { AdminSettingsScreenProps } from './AdminSettingsTypes';
import { useAdminSettings } from './useAdminSettings';

function SettingsField({ label, value, fillVersion, change, name }: { label: string; value: string; fillVersion: number;
  change: (value: string) => void; name: AdminSettingsField }) {
  const native = useNativeState(value), filled = useRef(fillVersion), colors = useMaterialColors();
  useEffect(() => { if (filled.current !== fillVersion) { filled.current = fillVersion; native.set(value); } }, [native, fillVersion, value]);
  return <OutlinedTextField value={native} onValueChange={change} singleLine textStyle={{ fontSize: 16 }}
    shape={Shape.RoundedCorner({ cornerRadii: { topStart: 16, topEnd: 16, bottomStart: 16, bottomEnd: 16 } })}
    colors={{ focusedContainerColor: colors.surfaceContainerLow, unfocusedContainerColor: colors.surfaceContainerLow }}
    modifiers={[fillMaxWidth(), testID(`admin-settings-${name}`)]}>
    <OutlinedTextField.Label><Text style={{ fontSize: 14 }}>{label}</Text></OutlinedTextField.Label>
  </OutlinedTextField>;
}

/** @v2 AdminSettingsScreen */
export function AdminSettingsScreen(props: AdminSettingsScreenProps) {
  const model = useAdminSettings(props), { state, current, t, a, p } = model, colors = useMaterialColors(), insets = useSafeAreaInsets();
  const snackbar = useRef<SnackbarHostRef>(null), shown = useRef<number | null>(null), notice = t('settingsSaved');
  useEffect(() => { if (state.notice !== null && state.notice !== shown.current && current) {
    shown.current = state.notice; void snackbar.current?.showSnackbar({ message: notice, duration: 'short' });
  } }, [state.notice, current, notice]);
  if (!model.current || state.phase === 'invalidated') return <View style={styles.root} />;
  const field = (name: AdminSettingsField) => <SettingsField key={name} name={name} value={state.fields[name]} fillVersion={state.fillVersion}
    label={a(`settings.${adminSettingsFieldLabels[name]}`)} change={value => model.change(name, value)} />;
  return <View style={[styles.root, { paddingTop: insets.top, backgroundColor: colors.surface }]}>
    <RoleHeader title={t('adminSettingsTitle')} navigation={model.navigation ?? undefined} />
    <BaseHost style={styles.body}>
      {state.phase === 'loading' ? <Column modifiers={[fillMaxSize()]} verticalArrangement="center" horizontalAlignment="center"><CircularProgressIndicator /></Column> :
        state.phase === 'error' ? <Column modifiers={[fillMaxSize(), padding(24, 24, 24, 24)]} verticalArrangement="center" horizontalAlignment="center">
          <Text>{t('serverDisconnectedRetry')}</Text><TextButton onClick={() => { model.reload(); }}><Text>{t('retry')}</Text></TextButton>
        </Column> : <Column modifiers={[fillMaxWidth(), verticalScroll(), padding(12, 4, 14, insets.bottom + 136)]}>
          {model.additional ? <ListItem modifiers={[combinedClickable({ onClick: () => model.navigate(appRoutes.adminAdditionalSettings) })]}>
            <ListItem.LeadingContent><RNHostView matchContents><SymbolView name={{ android: 'tune' }} size={24} tintColor={colors.onSurfaceVariant} /></RNHostView></ListItem.LeadingContent>
            <ListItem.HeadlineContent><Text>{p('paddon.management.settings.title')}</Text></ListItem.HeadlineContent>
            <ListItem.TrailingContent><RNHostView matchContents><SymbolView name={{ android: 'chevron_right' }} size={24} tintColor={colors.onSurfaceVariant} /></RNHostView></ListItem.TrailingContent>
          </ListItem> : null}
          {model.push ? <ListItem modifiers={[combinedClickable({ onClick: () => model.navigate(appRoutes.adminPushConfig) })]}>
            <ListItem.LeadingContent><RNHostView matchContents><SymbolView name={{ android: 'notifications_active' }} size={24} tintColor={colors.onSurfaceVariant} /></RNHostView></ListItem.LeadingContent>
            <ListItem.HeadlineContent><Text>{a('push.title')}</Text></ListItem.HeadlineContent>
            <ListItem.TrailingContent><RNHostView matchContents><SymbolView name={{ android: 'chevron_right' }} size={24} tintColor={colors.onSurfaceVariant} /></RNHostView></ListItem.TrailingContent>
          </ListItem> : null}
          <Text style={{ typography: 'titleLarge' }}>{t('erpConnectionTitle')}</Text><Spacer modifiers={[height(6)]} />
          <Text color={colors.onSurfaceVariant} style={{ typography: 'bodySmall', lineHeight: 17.4 }}>{t('erpConnectionSubtitle')}</Text><Spacer modifiers={[height(18)]} />
          {adminSettingsFieldNames.slice(0, 5).map((name, index) => <Column key={name} modifiers={[fillMaxWidth()]}>
            {index ? <Spacer modifiers={[height(14)]} /> : null}{field(name)}</Column>)}
          <Spacer modifiers={[height(16)]} /><Text style={{ typography: 'titleLarge' }}>{t('adminSettingsSectionTitle')}</Text><Spacer modifiers={[height(6)]} />
          <Text color={colors.onSurfaceVariant} style={{ typography: 'bodySmall', lineHeight: 17.4 }}>{t('adminSettingsSectionSubtitle')}</Text><Spacer modifiers={[height(18)]} />
          {field('werka_phone')}<Spacer modifiers={[height(12)]} />{field('werka_name')}<Spacer modifiers={[height(18)]} />
          <Button onClick={model.save} enabled={!state.saving} shape={Shape.RoundedCorner({ cornerRadii: { topStart: 20, topEnd: 20, bottomStart: 20, bottomEnd: 20 } })}
            modifiers={[fillMaxWidth(), height(56), testID('admin-settings-save')]}>
            <Row verticalAlignment="center" horizontalArrangement={{ spacedBy: 8 }}>
              {state.saving ? <CircularProgressIndicator modifiers={[size(18, 18)]} /> : <RNHostView matchContents><SymbolView name={{ android: 'check' }} size={24} tintColor={colors.onPrimary} /></RNHostView>}
              <Text>{t(state.saving ? 'pinSaving' : 'save')}</Text>
            </Row>
          </Button>
        </Column>}
    </BaseHost>
    {props.footer}
    <View pointerEvents="none" style={[styles.notice, { bottom: insets.bottom + 16 }]}><BaseHost matchContents={{ vertical: true }}><SnackbarHost ref={snackbar} /></BaseHost></View>
  </View>;
}
const styles = StyleSheet.create({ root: { flex: 1 }, body: { flex: 1 }, notice: { position: 'absolute', left: 16, right: 16 } });
