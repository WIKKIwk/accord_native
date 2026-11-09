import { Button, HStack, Image, List, Menu, ProgressView, Section, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import { accessibilityHidden, background, buttonStyle, clipShape, disabled, font, foregroundStyle, frame, labelStyle,
  listStyle, padding, refreshable, textSelection } from '@expo/ui/swift-ui/modifiers';
import { Stack } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useSyncExternalStore } from 'react';
import { PlatformColor, Pressable, StyleSheet, Text as NativeText, View } from 'react-native';
import { BaseHost } from '../components/BaseHost.ios';
import { useBaseTheme } from '../components/useBaseTheme';
import { localeController } from '../shared/localization/runtime';
import { RoleHeaderButton } from '../shared/navigation/RoleHeaderButton';
import type { AdminApparatus } from '../apparatusApi';
import type { AdminFactoryLocation } from './factoryLocationModel';
import { factoryLocationApparatusLabels, factoryLocationNoticeText, factoryLocationScreenText } from './factoryLocationScreenModel';
import type { FactoryLocationScreenProps } from './factoryLocationScreenTypes';
import { useFactoryLocationScreen } from './useFactoryLocationScreen';

const subscribeLocale = (listener: () => void) => localeController.addListener(listener);
const currentLocale = () => localeController.locale;
function LocationRow({ location, apparatus, disabled: locked, text, onEdit, onRename, onActive }: { location: AdminFactoryLocation;
  apparatus: readonly AdminApparatus[]; disabled: boolean; text: ReturnType<typeof factoryLocationScreenText>;
  onEdit: () => void; onRename: () => void; onActive: () => void }) {
  const theme = useBaseTheme(), names = factoryLocationApparatusLabels(location, apparatus), equipment = location.apparatus.length > 0;
  const badge = (label: string, color: string) => <Text modifiers={[font({ textStyle: 'caption', weight: 'medium' }),
    padding({ horizontal: 9, vertical: 4 }), background(color), clipShape('capsule')]}>{label}</Text>;
  return <HStack alignment="top" spacing={12}>
    <Button onPress={onEdit} modifiers={[buttonStyle('plain'), disabled(locked)]}>
      <HStack alignment="top" spacing={12}>
        <Image systemName={equipment ? 'gearshape.2' : 'mappin'} modifiers={[foregroundStyle(location.active ? theme.colors.primary : theme.colors.onSurfaceVariant), accessibilityHidden()]} />
        <VStack alignment="leading" spacing={4}>
          <Text modifiers={[font({ textStyle: 'body', weight: 'bold' })]}>{location.name}</Text>
          <Text modifiers={[font({ textStyle: 'caption' }), foregroundStyle(theme.colors.onSurfaceVariant), textSelection(true)]}>{location.id}</Text>
          <HStack spacing={6}>{badge(equipment ? text.equipment : text.ordinary, equipment ? theme.colors.primaryContainer : theme.colors.surfaceContainerHighest)}
            {!location.active ? badge(text.inactive, theme.colors.errorContainer) : null}</HStack>
          {location.apparatus.length ? <Text modifiers={[foregroundStyle(theme.colors.onSurfaceVariant)]}>{names}</Text> : null}
        </VStack><Spacer />
      </HStack>
    </Button>
    <Menu label={text.actions} systemImage="ellipsis" modifiers={[labelStyle('iconOnly'), disabled(locked)]}>
      <Button label={text.edit} onPress={onEdit} /><Button label={text.rename} onPress={onRename} />
      <Button label={location.active ? text.deactivate : text.activate} onPress={onActive} />
    </Menu>
  </HStack>;
}
export function FactoryLocationScreen(props: FactoryLocationScreenProps) {
  const state = useFactoryLocationScreen(props), locale = useSyncExternalStore(subscribeLocale, currentLocale, currentLocale);
  const text = factoryLocationScreenText(locale), { controller, navigation, footer } = props;
  const openEditor = (id: string | null) => { const ticket = controller.beginEditor(id); if (ticket) props.onOpenEditor(ticket); };
  const rename = (id: string) => { const ticket = controller.beginEditor(id); if (ticket) props.onOpenRename(ticket); };
  return <>
    <Stack.Screen options={{ headerShown: true, title: text.title,
      headerLeft: navigation ? () => <RoleHeaderButton {...navigation} tintColor={PlatformColor('label')} /> : undefined,
      headerRight: () => <Pressable accessibilityRole="button" accessibilityLabel={text.create} disabled={state.saving || state.status === 'forbidden'}
        onPress={() => openEditor(null)} hitSlop={8} style={styles.add}>
        <SymbolView name="mappin.and.ellipse" size={21} tintColor={PlatformColor('label')} />
      </Pressable> }} />
    <View style={styles.screen}><BaseHost style={styles.content}>
      {state.status === 'loading' ? <VStack modifiers={[frame({ maxWidth: Infinity, maxHeight: Infinity })]}><ProgressView /></VStack> :
        state.status === 'error' ? <VStack spacing={16}><Text>{text.loadError}</Text><Button label={text.retry} onPress={() => { void controller.load(); }} /></VStack> :
          state.status === 'ready' ? <List modifiers={[listStyle('plain'), refreshable(() => controller.load())]}>
            <Section><Button label={text.create} systemImage="plus" onPress={() => openEditor(null)} modifiers={[disabled(state.saving)]} /></Section>
            {state.locations.length === 0 ? <Section><Text>{text.empty}</Text></Section> : <Section>
              {state.locations.map(location => <LocationRow key={location.id} location={location} apparatus={state.apparatus} disabled={state.saving} text={text}
                onEdit={() => openEditor(location.id)} onRename={() => rename(location.id)} onActive={() => { void controller.setActive(location.id, !location.active); }} />)}
            </Section>}
          </List> : null}
    </BaseHost>{footer}
      {state.notice ? <View pointerEvents="none" accessibilityRole="alert" style={[styles.notice, { backgroundColor: PlatformColor('secondarySystemBackground') }]}>
        <NativeText style={{ color: PlatformColor('label') }}>{factoryLocationNoticeText(state.notice, locale)}</NativeText>
      </View> : null}
    </View>
  </>;
}
const styles = StyleSheet.create({ screen: { flex: 1 }, content: { flex: 1 }, add: { width: 42, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  notice: { position: 'absolute', left: 16, right: 16, bottom: 16, borderRadius: 12, padding: 12 } });
