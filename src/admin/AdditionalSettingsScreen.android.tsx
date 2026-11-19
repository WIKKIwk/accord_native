import { useBaseTheme } from '../components/useBaseTheme';
import { BasicAlertDialog, Button, Card, CircularProgressIndicator, Column, IconButton, RNHostView, LinearProgressIndicator, Row, Shape, SnackbarHost, Spacer, Surface, Switch,
  Text, TextButton, type SnackbarHostRef } from '@expo/ui/jetpack-compose';
import { defaultMinSize, fillMaxWidth, height as nativeHeight, padding, semantics, size, testID, toggleable, verticalScroll, weight, width as nativeWidth } from '@expo/ui/jetpack-compose/modifiers';
import { SymbolView } from 'expo-symbols';
import { useEffect, useRef, useSyncExternalStore } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BaseHost as Host } from '../components/BaseHost.android';
import { AdminScreenHeader } from './AdminTopBar.android';
import { AdminShellBodyFrame } from './AdminShellBodyFrame';
import { localeController } from '../shared/localization/runtime';
import { additionalSettingsCards, additionalSettingsNotice, additionalSettingsText, changeAdditionalSetting } from './additionalSettingsViewModel';
import type { AdditionalSettingsScreenProps } from './additionalSettingsTypes';
import { useAdditionalSettings } from './useAdditionalSettings';

const subscribeLocale = (listener: () => void) => localeController.addListener(listener);
const currentLocale = () => localeController.locale;
const rounded = (radius: number) => Shape.RoundedCorner({ cornerRadii: { topStart: radius, topEnd: radius, bottomStart: radius, bottomEnd: radius } });
const withAlpha = (rgba: string, alpha: number) => `${rgba.slice(0, 7)}${Math.round(alpha * 255).toString(16).padStart(2, '0')}`;

// The shared shell supplies the existing role drawer and appropriate dock; this screen does not invent navigation.
// @v2 AdminAdditionalSettingsScreen
export function AdditionalSettingsScreen({ session, witness, isCurrent, navigation, footer, topNotice, profileAction }: AdditionalSettingsScreenProps) {
  const { state, controller, isCurrent: current } = useAdditionalSettings(session, witness, isCurrent), locale = useSyncExternalStore(subscribeLocale, currentLocale, currentLocale);
  const t = additionalSettingsText(locale), cards = additionalSettingsCards(state, locale), colors = useBaseTheme().colors;
  const { width, height } = useWindowDimensions(), insets = useSafeAreaInsets(), snackbar = useRef<SnackbarHostRef>(null);
  useEffect(() => {
    if (state.notice) void snackbar.current?.showSnackbar({ message: additionalSettingsNotice(state.notice, locale), duration: 'short' });
  }, [state.notice, locale]);
  const retryCard = (id: string) => {
    if (id === 'appUpdate' || id === 'lamination' || id === 'qolip') controller.retryCard(id);
  };
  const refreshingDisabled = state.screen === 'content' && state.paddon.busy;
  return <View style={[styles.screen, { backgroundColor: colors.surfaceContainerHigh, paddingTop: insets.top }]}>
    <AdminScreenHeader title={t.title} navigation={navigation} profileAction={profileAction}
      actions={<IconButton enabled={!refreshingDisabled} modifiers={[size(48, 48), semantics({ contentDescription: t.retry }), testID('additional-settings-refresh')]}
        onClick={() => { if (current()) void controller.refresh(); }}><RNHostView matchContents>
        <SymbolView name={{ android: 'refresh' }} size={24} tintColor={colors.onSurface} />
      </RNHostView></IconButton>} />
    {topNotice}
    <AdminShellBodyFrame hasFooter={footer != null} testID="admin-additional-settings-body-frame">
    <Host style={styles.content}>
      <Column modifiers={[fillMaxWidth(), verticalScroll(), padding(12, 12, 12, 144)]}>
        {state.screen === 'loading' ? <CircularProgressIndicator /> : null}
        {state.screen === 'error' ? <Column modifiers={[fillMaxWidth()]}><Text>{t.loadError}</Text>
          <TextButton onClick={() => { void controller.refresh(); }}><Text>{t.retry}</Text></TextButton></Column> : null}
        {cards.map(card => <Card key={card.id} modifiers={[fillMaxWidth(), padding(4, 4, 4, 4)]}>
          <Column modifiers={[fillMaxWidth()]}>
            {card.rows.map(row => <Row key={row.action} verticalAlignment="center" modifiers={[fillMaxWidth(),
              toggleable(row.value, () => changeAdditionalSetting(controller, row.action, !row.value), { role: 'switch', enabled: row.enabled }),
              testID(row.testID), defaultMinSize({ minHeight: 72 }), padding(16, 8, 16, 8)]}>
              <Column modifiers={[weight(1), padding(0, 0, 16, 0)]}><Text style={{ typography: 'bodyLarge' }}>{row.title}</Text><Text style={{ typography: 'bodyMedium' }} color={colors.onSurfaceVariant}>{row.subtitle}</Text></Column>
              <Switch value={row.value} enabled={row.enabled} />
            </Row>)}
            {card.busy ? <LinearProgressIndicator modifiers={[fillMaxWidth()]} /> : null}
            {card.error ? <><Text>{card.error}</Text><TextButton onClick={() => retryCard(card.id)}><Text>{t.retry}</Text></TextButton></> : null}
          </Column>
        </Card>)}
        {state.screen === 'content' && state.paddon.busy ? <LinearProgressIndicator modifiers={[fillMaxWidth()]} /> : null}
      </Column>
    </Host>
    </AdminShellBodyFrame>
    <View pointerEvents="box-none" style={styles.footer}>{footer}</View>
    <View pointerEvents="none" style={[styles.snackbar, { bottom: insets.bottom + 16 }]}><Host matchContents={{ vertical: true }}><SnackbarHost ref={snackbar} /></Host></View>
    {state.confirmFreeMovement ? <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, width, height }}>
      <Host style={{ width, height }}><BasicAlertDialog properties={{ usePlatformDefaultWidth: false }}
        onDismissRequest={() => { if (current()) controller.resolveFreeMovement(false, state.confirmationSerial); }}>
        <Surface modifiers={[nativeWidth(Math.min(width - 48, 420))]} color={colors.surfaceContainerHigh}
          contentColor={colors.onSurface} shape={rounded(28)} border={{ width: 1, color: withAlpha(colors.outlineVariant, 0.65) }}>
          <Column modifiers={[fillMaxWidth(), verticalScroll(), padding(24, 24, 24, 20)]}>
            <Text style={{ typography: 'headlineSmall' }}>{t.confirmTitle}</Text>
            <Spacer modifiers={[nativeHeight(10)]} />
            <Text style={{ typography: 'bodyLarge', lineHeight: 23.2 }} color={colors.onSurfaceVariant}>{t.confirmMessage}</Text>
            <Spacer modifiers={[nativeHeight(22)]} />
            <Row modifiers={[fillMaxWidth()]}>
              <Surface modifiers={[weight(1)]} shape={rounded(20)} color={colors.surfaceContainerLow}
                border={{ width: 1, color: withAlpha(colors.outlineVariant, 0.95) }}>
                <Button modifiers={[fillMaxWidth(), defaultMinSize({ minHeight: 56 })]} shape={rounded(20)}
                  colors={{ containerColor: colors.surfaceContainerLow, contentColor: colors.onSurface }}
                  onClick={() => { if (current()) controller.resolveFreeMovement(false, state.confirmationSerial); }}><Text style={{ typography: 'labelLarge' }}>{t.no}</Text></Button>
              </Surface>
              <Spacer modifiers={[nativeWidth(12)]} />
              <Button modifiers={[weight(1), defaultMinSize({ minHeight: 56 }), testID('paddon-free-movement-confirm')]}
                shape={rounded(20)} colors={{ containerColor: colors.primaryContainer, contentColor: colors.onPrimaryContainer }}
                onClick={() => { if (current()) controller.resolveFreeMovement(true, state.confirmationSerial); }}><Text style={{ typography: 'labelLarge' }}>{t.yes}</Text></Button>
            </Row>
          </Column>
        </Surface>
      </BasicAlertDialog></Host>
    </View> : null}
  </View>;
}
const styles = StyleSheet.create({ screen: { flex: 1 }, content: { flex: 1 },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  snackbar: { position: 'absolute', left: 16, right: 16, bottom: 16 } });
