import { MenuView, type MenuAction } from '@expo/ui/community/menu';
import { Button, HStack, Image, List, ProgressView, Section, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import { background, contentShape, disabled, font, foregroundStyle, frame, listStyle, onLongPressGesture, onTapGesture, padding, refreshable, shapes } from '@expo/ui/swift-ui/modifiers';
import { Stack } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { PlatformColor, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BaseHost } from './BaseHost';
import { WorkerPaddonDialog } from './WorkerPaddonDialog';
import { WorkerPaddonFeedback } from './WorkerPaddonFeedback';
import { useWorkerColors } from './useWorkerColors';
import { useWorkerPaddonList, type WorkerPaddonListProps } from './useWorkerPaddonList';

// @v2 AparatchiPaddonsScreen
export function WorkerPaddonList(props: WorkerPaddonListProps) {
  const h = useWorkerPaddonList(props), { state, p } = h, colors = useWorkerColors(), insets = useSafeAreaInsets();
  if (!h.current()) return null;
  const fabBottom = Math.max(88, insets.bottom + 70);
  const actions: MenuAction[] = [
    ...(h.canTransfer ? [{ id: 'transfer', title: p('worker.paddon.transfer.title'), image: 'arrow.up.arrow.down' as const }] : []),
    ...(state.apparatus ? [{ id: 'create', title: p('worker.paddon.create'), image: 'plus' as const, attributes: { disabled: !h.canCreate } }] : []),
  ];
  const metric = (label: string, value: number) => <Text modifiers={[
    font({ textStyle: 'subheadline', weight: 'semibold' }), padding({ horizontal: 12, vertical: 8 }),
    background(PlatformColor('tertiarySystemFill'), shapes.roundedRectangle({ cornerRadius: 12 })),
  ]}>{`${label}: ${value}`}</Text>;
  return <View style={{ flex: 1, backgroundColor: colors.background }}>
    <Stack.Screen options={{ title: h.title, headerBackButtonDisplayMode: 'minimal' }} />
    <BaseHost matchContents={{ vertical: true }} style={{ width: '100%', paddingHorizontal: 20, paddingTop: 8 }}>
      <Text modifiers={[font({ textStyle: 'subheadline' }), foregroundStyle('secondary')]}>{p('worker.paddon.subtitle')}</Text>
    </BaseHost>
    <BaseHost style={{ flex: 1, marginBottom: fabBottom }}><List modifiers={[listStyle('insetGrouped'), refreshable(() => h.controller.load())]}>
      {state.phase === 'loading' ? <ProgressView /> : state.phase === 'error' ? <Section>
        <Text>{p('worker.paddon.load_failed')}</Text><Button label={h.t('Qayta urinish')} onPress={() => { void h.controller.load(); }} />
      </Section> : !state.apparatus ? <Section>{state.options.map(option => <Button key={option.id} label={p('worker.paddon.apparatus', { apparatus: option.name })}
        onPress={() => { void h.controller.select(option.id); }} />)}</Section> : <>
        <Section><VStack alignment="leading" spacing={10} modifiers={[padding({ vertical: 6 })]}>
          <Text modifiers={[font({ textStyle: 'title3', weight: 'bold' })]}>{p('worker.paddon.location.title')}</Text>
          <Text modifiers={[foregroundStyle('secondary')]}>{p('worker.paddon.location.subtitle')}</Text>
          <HStack spacing={8}>{metric(p('worker.paddons'), state.rows.length)}{metric(p('worker.daily.wip'), state.rows.reduce((sum, row) => sum + row.item_count, 0))}</HStack>
        </VStack></Section>
        <Section title={h.title}>{state.rows.length ? state.rows.map(row => <HStack key={row.code} spacing={12} modifiers={[
          padding({ vertical: 8 }), frame({ maxWidth: Infinity, alignment: 'leading' }), contentShape(shapes.rectangle()),
          onTapGesture(() => h.open(row)), onLongPressGesture(() => { if (h.canDelete) void h.remove(row); }), disabled(!h.enabled),
        ]}>
          <Image systemName="shippingbox.fill" size={23} color={PlatformColor('systemBlue')} />
          <VStack alignment="leading" spacing={4}><Text modifiers={[font({ textStyle: 'headline' })]}>{row.code}</Text>
            {row.contains_peremotka ? <Text modifiers={[font({ textStyle: 'caption' }), foregroundStyle('secondary')]}>{p('worker.rezka.print.peremotka')}</Text> : null}
          </VStack>
          <Spacer /><Text modifiers={[font({ textStyle: 'subheadline', weight: 'semibold' }), foregroundStyle(PlatformColor('systemBlue'))]}>{p('worker.paddon.wip_count', { count: row.item_count })}</Text>
          <Image systemName="chevron.right" size={15} modifiers={[foregroundStyle('secondary')]} />
        </HStack>) : <VStack spacing={8}><Text modifiers={[font({ textStyle: 'headline' })]}>{p('worker.paddon.empty.title')}</Text>
          <Text modifiers={[foregroundStyle('secondary')]}>{p('worker.paddon.empty.body')}</Text></VStack>}</Section>
      </>}
    </List></BaseHost>
    {actions.length ? <MenuView actions={actions} style={{ position: 'absolute', right: 16, bottom: fabBottom, width: 56, height: 56 }}
      onPressAction={event => {
        if (event.nativeEvent.event === 'transfer' && h.canTransfer) h.transfer();
        else if (event.nativeEvent.event === 'create' && h.canCreate) void h.create();
      }}>
      <View accessibilityRole="button" accessibilityLabel={h.t('Amallar')} style={{ width: 56, height: 56, alignItems: 'center', justifyContent: 'center' }}>
        <SymbolView name="plus.circle.fill" size={44} tintColor={PlatformColor('systemBlue')} />
      </View>
    </MenuView> : null}
    <WorkerPaddonDialog data={h.presentation.data} visible={h.presentation.visible} close={h.presentation.close} dismissed={h.presentation.dismissed} />
    <WorkerPaddonFeedback message={h.presentation.notice} />
  </View>;
}
