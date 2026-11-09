import { Alert, Button, Host, List, ProgressView, Section, Text, Toggle } from '@expo/ui/swift-ui';
import { accessibilityIdentifier, disabled, listStyle } from '@expo/ui/swift-ui/modifiers';
import { Stack } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useEffect, useRef, useSyncExternalStore } from 'react';
import { PlatformColor, Pressable, StyleSheet, Text as NativeText, useWindowDimensions, View } from 'react-native';
import { BaseHost } from '../components/BaseHost.ios';
import { RoleHeaderButton } from '../shared/navigation/RoleHeaderButton';
import { localeController } from '../shared/localization/runtime';
import { additionalSettingsCards, additionalSettingsNotice, additionalSettingsText, changeAdditionalSetting } from './additionalSettingsViewModel';
import type { AdditionalSettingsScreenProps } from './additionalSettingsTypes';
import { useAdditionalSettings } from './useAdditionalSettings';

const subscribeLocale = (listener: () => void) => localeController.addListener(listener);
const currentLocale = () => localeController.locale;

// The shared shell supplies the existing role drawer and appropriate dock; this screen does not invent navigation.
export function AdditionalSettingsScreen({ session, navigation, footer }: AdditionalSettingsScreenProps) {
  const { state, controller } = useAdditionalSettings(session), locale = useSyncExternalStore(subscribeLocale, currentLocale, currentLocale);
  const t = additionalSettingsText(locale), cards = additionalSettingsCards(state, locale), { width, height } = useWindowDimensions();
  const dismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (dismissTimer.current) clearTimeout(dismissTimer.current); }, []);
  const cancelConfirmation = () => {
    const serial = state.confirmationSerial;
    if (dismissTimer.current) clearTimeout(dismissTimer.current);
    // Some native alert implementations notify dismissal before the pressed button callback.
    dismissTimer.current = setTimeout(() => {
      if (controller.getSnapshot().confirmationSerial === serial) controller.resolveFreeMovement(false);
    }, 250);
  };
  const confirm = () => {
    if (dismissTimer.current) clearTimeout(dismissTimer.current);
    controller.resolveFreeMovement(true);
  };
  const retryCard = (id: string) => {
    if (id === 'appUpdate' || id === 'lamination' || id === 'qolip') controller.retryCard(id);
  };
  const refreshingDisabled = state.screen === 'content' && state.paddon.busy;
  const notice = state.notice ? additionalSettingsNotice(state.notice, locale) : null;
  return <>
    <Stack.Screen options={{ headerShown: true, title: t.title,
      headerLeft: navigation ? () => <RoleHeaderButton {...navigation} tintColor={PlatformColor('label')} /> : undefined,
      headerRight: () => <Pressable accessibilityRole="button" accessibilityLabel={t.retry} testID="additional-settings-refresh"
        disabled={refreshingDisabled} onPress={() => { void controller.refresh(); }} hitSlop={8} style={styles.headerButton}>
        <SymbolView name="arrow.clockwise" size={21} tintColor={PlatformColor('label')} />
      </Pressable> }} />
    <View style={styles.screen}>
      <BaseHost style={styles.content}>
        <List modifiers={[listStyle('insetGrouped')]}>
          {state.screen === 'loading' ? <Section><ProgressView /></Section> : null}
          {state.screen === 'error' ? <Section><Text>{t.loadError}</Text><Button label={t.retry} onPress={() => { void controller.refresh(); }} /></Section> : null}
          {cards.map(card => <Section key={card.id}>
            {card.rows.map(row => <Toggle key={row.action} isOn={row.value} onIsOnChange={value => changeAdditionalSetting(controller, row.action, value)}
              modifiers={[disabled(!row.enabled), accessibilityIdentifier(row.testID)]}>
              <Text>{row.title}</Text><Text>{row.subtitle}</Text>
            </Toggle>)}
            {card.busy ? <ProgressView /> : null}
            {card.error ? <><Text>{card.error}</Text><Button label={t.retry} onPress={() => retryCard(card.id)} /></> : null}
          </Section>)}
          {state.screen === 'content' && state.paddon.busy ? <Section><ProgressView /></Section> : null}
        </List>
      </BaseHost>
      {footer}
      {notice ? <View pointerEvents="none" accessibilityRole="alert" style={[styles.notice, { backgroundColor: PlatformColor('secondarySystemBackground') }]}>
        <NativeText style={{ color: PlatformColor('label') }}>{notice}</NativeText>
      </View> : null}
      {state.confirmFreeMovement ? <Host style={{ position: 'absolute', top: 0, left: 0, width, height }} pointerEvents="none">
        <Alert title={t.confirmTitle} isPresented onIsPresentedChange={presented => { if (!presented) cancelConfirmation(); }}>
          <Alert.Trigger><Text> </Text></Alert.Trigger>
          <Alert.Message><Text>{t.confirmMessage}</Text></Alert.Message>
          <Alert.Actions>
            <Button label={t.no} role="cancel" onPress={() => controller.resolveFreeMovement(false)} />
            <Button label={t.yes} onPress={confirm} />
          </Alert.Actions>
        </Alert>
      </Host> : null}
    </View>
  </>;
}
const styles = StyleSheet.create({ screen: { flex: 1 }, content: { flex: 1 }, headerButton: { minWidth: 38, minHeight: 44, justifyContent: 'center', alignItems: 'center' },
  notice: { position: 'absolute', left: 16, right: 16, bottom: 16, borderRadius: 12, padding: 12 } });
