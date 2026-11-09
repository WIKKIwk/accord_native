import { AlertDialog, Card, CircularProgressIndicator, Column, LinearProgressIndicator, Row, SnackbarHost, Switch,
  Text, TextButton, useMaterialColors, type SnackbarHostRef } from '@expo/ui/jetpack-compose';
import { fillMaxWidth, padding, testID, toggleable, verticalScroll, weight } from '@expo/ui/jetpack-compose/modifiers';
import { SymbolView } from 'expo-symbols';
import { useEffect, useRef, useSyncExternalStore } from 'react';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BaseHost as Host } from '../components/BaseHost.android';
import { RoleHeader } from '../shared/navigation/RoleHeader.android';
import { localeController } from '../shared/localization/runtime';
import { additionalSettingsCards, additionalSettingsNotice, additionalSettingsText, changeAdditionalSetting } from './additionalSettingsViewModel';
import type { AdditionalSettingsScreenProps } from './additionalSettingsTypes';
import { useAdditionalSettings } from './useAdditionalSettings';

const subscribeLocale = (listener: () => void) => localeController.addListener(listener);
const currentLocale = () => localeController.locale;

// The shared shell supplies the existing role drawer and appropriate dock; this screen does not invent navigation.
export function AdditionalSettingsScreen({ session, navigation, footer }: AdditionalSettingsScreenProps) {
  const { state, controller } = useAdditionalSettings(session), locale = useSyncExternalStore(subscribeLocale, currentLocale, currentLocale);
  const t = additionalSettingsText(locale), cards = additionalSettingsCards(state, locale), colors = useMaterialColors();
  const { width, height } = useWindowDimensions(), insets = useSafeAreaInsets(), snackbar = useRef<SnackbarHostRef>(null);
  useEffect(() => {
    if (state.notice) void snackbar.current?.showSnackbar({ message: additionalSettingsNotice(state.notice, locale), duration: 'short' });
  }, [state.notice, locale]);
  const retryCard = (id: string) => {
    if (id === 'appUpdate' || id === 'lamination' || id === 'qolip') controller.retryCard(id);
  };
  const refreshingDisabled = state.screen === 'content' && state.paddon.busy;
  return <View style={[styles.screen, { backgroundColor: colors.surface }]}>
    <View style={[styles.header, { paddingTop: insets.top }]}>
      <View style={styles.headerTitle}><RoleHeader title={t.title} navigation={navigation ?? undefined} /></View>
      <Pressable accessibilityRole="button" accessibilityLabel={t.retry} testID="additional-settings-refresh" disabled={refreshingDisabled}
        onPress={() => { void controller.refresh(); }} hitSlop={8} style={styles.headerButton}>
        <SymbolView name={{ android: 'refresh', ios: 'arrow.clockwise' }} size={22} tintColor={colors.onSurface} />
      </Pressable>
    </View>
    <Host style={styles.content}>
      <Column modifiers={[fillMaxWidth(), verticalScroll(), padding(12, 12, 12, 24)]}>
        {state.screen === 'loading' ? <CircularProgressIndicator /> : null}
        {state.screen === 'error' ? <Column modifiers={[fillMaxWidth()]}><Text>{t.loadError}</Text>
          <TextButton onClick={() => { void controller.refresh(); }}><Text>{t.retry}</Text></TextButton></Column> : null}
        {cards.map(card => <Card key={card.id} modifiers={[fillMaxWidth(), padding(0, 0, 0, 8)]}>
          <Column modifiers={[fillMaxWidth(), padding(16, 12, 16, 12)]}>
            {card.rows.map(row => <Row key={row.action} verticalAlignment="center" modifiers={[fillMaxWidth(),
              toggleable(row.value, () => changeAdditionalSetting(controller, row.action, !row.value), { role: 'switch', enabled: row.enabled }),
              testID(row.testID), padding(0, 6, 0, 6)]}>
              <Column modifiers={[weight(1)]}><Text>{row.title}</Text><Text>{row.subtitle}</Text></Column>
              <Switch value={row.value} enabled={row.enabled} />
            </Row>)}
            {card.busy ? <LinearProgressIndicator modifiers={[fillMaxWidth()]} /> : null}
            {card.error ? <><Text>{card.error}</Text><TextButton onClick={() => retryCard(card.id)}><Text>{t.retry}</Text></TextButton></> : null}
          </Column>
        </Card>)}
        {state.screen === 'content' && state.paddon.busy ? <LinearProgressIndicator modifiers={[fillMaxWidth()]} /> : null}
      </Column>
    </Host>
    {footer ?? <View style={{ height: insets.bottom }} />}
    <View pointerEvents="none" style={[styles.snackbar, { bottom: insets.bottom + 16 }]}><Host matchContents={{ vertical: true }}><SnackbarHost ref={snackbar} /></Host></View>
    {state.confirmFreeMovement ? <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, width, height }}>
      <Host style={{ width, height }}><AlertDialog onDismissRequest={() => controller.resolveFreeMovement(false)}>
        <AlertDialog.Title><Text>{t.confirmTitle}</Text></AlertDialog.Title>
        <AlertDialog.Text><Text>{t.confirmMessage}</Text></AlertDialog.Text>
        <AlertDialog.DismissButton><TextButton onClick={() => controller.resolveFreeMovement(false)}><Text>{t.no}</Text></TextButton></AlertDialog.DismissButton>
        <AlertDialog.ConfirmButton><TextButton onClick={() => controller.resolveFreeMovement(true)} modifiers={[testID('paddon-free-movement-confirm')]}>
          <Text>{t.yes}</Text></TextButton></AlertDialog.ConfirmButton>
      </AlertDialog></Host>
    </View> : null}
  </View>;
}
const styles = StyleSheet.create({ screen: { flex: 1 }, content: { flex: 1 }, header: { flexDirection: 'row', alignItems: 'center' },
  headerTitle: { flex: 1 }, headerButton: { width: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  snackbar: { position: 'absolute', left: 16, right: 16, bottom: 16 } });
