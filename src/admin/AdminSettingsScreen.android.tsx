import { Button, CircularProgressIndicator, Column, IconButton, ListItem, RNHostView, Row, Shape, SnackbarHost, Spacer, TextButton,
  useNativeState, type SnackbarHostRef } from '@expo/ui/jetpack-compose';
import { AdminTopBar } from './AdminTopBar.android';
import { combinedClickable, defaultMinSize, fillMaxSize, fillMaxWidth, height, padding, semantics, size, testID, verticalScroll } from '@expo/ui/jetpack-compose/modifiers';
import { SymbolView } from 'expo-symbols';
import { useEffect, useRef, type ReactNode } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, { cancelAnimation, Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { BaseHost } from '../components/BaseHost.android';
import { useBaseTheme } from '../components/useBaseTheme';
import { appRoutes } from '../shared/appRoutes';
import { AdminLoadingIndicator } from './AdminLoadingIndicator.android';
import { AdminShellBodyFrame } from './AdminShellBodyFrame';
import { AdminOutlinedTextField as OutlinedTextField } from './AdminTextFields.android';
import { AdminText as Text } from './AdminTypography.android';
import { adminSettingsFieldLabels, adminSettingsFieldNames, type AdminSettingsField } from './adminSettingsController';
import type { AdminSettingsScreenProps } from './AdminSettingsTypes';
import { useAdminSettings } from './useAdminSettings';

/** V2 SmoothAppear applies its delay after the emphasized curve, within the total duration. */
function SettingsSection({ delay, children }: { delay: 20 | 60; children: ReactNode }) {
  const progress = useSharedValue(0);
  useEffect(() => {
    progress.value = withTiming(1, { duration: 260 + delay, easing: Easing.bezier(.05, .7, .1, 1) });
    return () => cancelAnimation(progress);
  }, [delay, progress]);
  const motion = useAnimatedStyle(() => {
    const value = Math.min(1, Math.max(0, (progress.value * (260 + delay) - delay) / 260));
    return { opacity: value, transform: [{ translateY: 16 * (1 - value) }] };
  });
  return <RNHostView matchContents={{ vertical: true }} modifiers={[fillMaxWidth()]}>
    <Animated.View style={[styles.fullWidth, motion]}><BaseHost matchContents={{ vertical: true }} style={styles.fullWidth}>
      <Column modifiers={[fillMaxWidth()]}>{children}</Column>
    </BaseHost></Animated.View>
  </RNHostView>;
}

function SettingsField({ label, value, fillVersion, change, name }: { label: string; value: string; fillVersion: number;
  change: (value: string) => void; name: AdminSettingsField }) {
  const native = useNativeState(value), filled = useRef(fillVersion), { colors, mode } = useBaseTheme();
  useEffect(() => { if (filled.current !== fillVersion) { filled.current = fillVersion; native.set(value); } }, [native, fillVersion, value]);
  return <OutlinedTextField value={native} onValueChange={change} singleLine textStyle={{ color: colors.onSurface, fontSize: 16, fontWeight: '400' }}
    shape={Shape.RoundedCorner({ cornerRadii: { topStart: 16, topEnd: 16, bottomStart: 16, bottomEnd: 16 } })}
    colors={{ focusedContainerColor: mode === 'dark' ? colors.surfaceContainerHigh : colors.surfaceContainerHighest,
      unfocusedContainerColor: mode === 'dark' ? colors.surfaceContainerHigh : colors.surfaceContainerHighest,
      focusedIndicatorColor: colors.primary, unfocusedIndicatorColor: colors.outlineVariant,
      focusedLabelColor: colors.onSurfaceVariant, unfocusedLabelColor: colors.onSurfaceVariant }}
    modifiers={[fillMaxWidth(), testID(`admin-settings-${name}`)]}>
    <OutlinedTextField.Label><Text style={{ fontSize: 14, fontWeight: '400' }}>{label}</Text></OutlinedTextField.Label>
  </OutlinedTextField>;
}

/** @v2 AdminSettingsScreen */
export function AdminSettingsScreen(props: AdminSettingsScreenProps) {
  const model = useAdminSettings(props), { state, current, t, a, p } = model, { colors } = useBaseTheme(), insets = useSafeAreaInsets(), { width } = useWindowDimensions();
  const snackbar = useRef<SnackbarHostRef>(null), shown = useRef<number | null>(null), notice = t('settingsSaved');
  useEffect(() => { if (state.notice !== null && state.notice !== shown.current && current) {
    shown.current = state.notice; void snackbar.current?.showSnackbar({ message: notice, duration: 'short' });
  } }, [state.notice, current, notice]);
  if (!model.current || state.phase === 'invalidated') return <View style={styles.root} />;
  const field = (name: AdminSettingsField) => <SettingsField key={name} name={name} value={state.fields[name]} fillVersion={state.fillVersion}
    label={a(`settings.${adminSettingsFieldLabels[name]}`)} change={value => model.change(name, value)} />;
  return <View style={[styles.root, { paddingTop: insets.top, backgroundColor: colors.surfaceContainerHigh }]}>
    <SafeAreaView edges={['left', 'right']} testID="admin-settings-header-safe-area"><BaseHost matchContents={{ vertical: true }} style={styles.fullWidth}><Column modifiers={[fillMaxWidth()]}>
      <AdminTopBar leading={model.navigation ? <IconButton onClick={model.navigation.onPress} modifiers={[semantics({ contentDescription: model.navigation.label }), testID('admin-settings-back')]}><RNHostView matchContents><SymbolView name={{ android: model.navigation.icon === 'back' ? 'arrow_back' : 'menu' }} size={24} tintColor={colors.onSurface} /></RNHostView></IconButton> : null}
        title={<Text style={{ fontSize: 24, fontWeight: '800' }}>{t('adminSettingsTitle')}</Text>}
        actions={props.profileAction ? <RNHostView matchContents><View style={styles.profile}>{props.profileAction}</View></RNHostView> : null} /><Spacer modifiers={[height(3)]} />
    </Column></BaseHost></SafeAreaView>
    {props.topNotice}<AdminShellBodyFrame hasFooter={props.footer != null} testID="admin-settings-body-frame"><View style={styles.content}>
      {state.phase === 'error' ? <View style={styles.retry}><BaseHost matchContents={{ vertical: true }} style={{ width: Math.min(Math.max(width * .88, 280), 360), maxWidth: '100%' }}>
        <Column horizontalAlignment="center" modifiers={[fillMaxWidth()]}><Text color={colors.onSurfaceVariant} style={{ typography: 'bodyLarge', textAlign: 'center', lineHeight: 21.6 }}>{t('serverDisconnectedRetry')}</Text><Spacer modifiers={[height(16)]} />
          <TextButton onClick={() => { model.reload(); }} colors={{ contentColor: colors.primary }} contentPadding={{ start: 12, end: 12, top: 8, bottom: 8 }} modifiers={[defaultMinSize({ minWidth: 0, minHeight: 0 })]}><Text style={{ typography: 'bodyMedium', fontWeight: '600' }}>{t('retry')}</Text></TextButton>
        </Column></BaseHost></View> : <BaseHost style={styles.body}>{state.phase === 'loading' ? <Column modifiers={[fillMaxSize()]} verticalArrangement="center" horizontalAlignment="center"><AdminLoadingIndicator /></Column> :
        <Column modifiers={[fillMaxWidth(), verticalScroll(), padding(0, 4, 0, insets.bottom + 136)]}>
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
          <SettingsSection delay={20}><Text style={{ typography: 'titleLarge' }}>{t('erpConnectionTitle')}</Text><Spacer modifiers={[height(6)]} />
          <Text color={colors.onSurfaceVariant} style={{ typography: 'bodySmall', lineHeight: 17.4 }}>{t('erpConnectionSubtitle')}</Text><Spacer modifiers={[height(18)]} />
          {adminSettingsFieldNames.slice(0, 5).map((name, index) => <Column key={name} modifiers={[fillMaxWidth()]}>
            {index ? <Spacer modifiers={[height(14)]} /> : null}{field(name)}</Column>)}
          </SettingsSection><Spacer modifiers={[height(16)]} /><SettingsSection delay={60}><Text style={{ typography: 'titleLarge' }}>{t('adminSettingsSectionTitle')}</Text><Spacer modifiers={[height(6)]} />
          <Text color={colors.onSurfaceVariant} style={{ typography: 'bodySmall', lineHeight: 17.4 }}>{t('adminSettingsSectionSubtitle')}</Text><Spacer modifiers={[height(18)]} />
          {field('werka_phone')}<Spacer modifiers={[height(12)]} />{field('werka_name')}<Spacer modifiers={[height(18)]} />
          <Button onClick={model.save} enabled={!state.saving} shape={Shape.RoundedCorner({ cornerRadii: { topStart: 20, topEnd: 20, bottomStart: 20, bottomEnd: 20 } })}
            modifiers={[fillMaxWidth(), height(56), testID('admin-settings-save')]}>
            <Row verticalAlignment="center" horizontalArrangement={{ spacedBy: 8 }}>
              {state.saving ? <CircularProgressIndicator modifiers={[size(18, 18)]} /> : <RNHostView matchContents><SymbolView name={{ android: 'check' }} size={24} tintColor={colors.onPrimary} /></RNHostView>}
              <Text style={{ typography: 'labelLarge' }}>{t(state.saving ? 'pinSaving' : 'save')}</Text>
            </Row>
          </Button></SettingsSection>
        </Column>}
    </BaseHost>}
    </View></AdminShellBodyFrame>
    <View pointerEvents="box-none" style={styles.footer}>{props.footer}</View>
    <View pointerEvents="none" style={[styles.notice, { bottom: insets.bottom + 16 }]}><BaseHost matchContents={{ vertical: true }}><SnackbarHost ref={snackbar} /></BaseHost></View>
  </View>;
}
const styles = StyleSheet.create({ root: { flex: 1 }, body: { flex: 1 }, fullWidth: { width: '100%' }, content: { flex: 1, paddingStart: 12, paddingEnd: 14 },
  retry: { flex: 1, paddingHorizontal: 24, paddingVertical: 40, alignItems: 'center' }, profile: { width: 58, height: 60, justifyContent: 'center' },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0 }, notice: { position: 'absolute', left: 16, right: 16 } });
