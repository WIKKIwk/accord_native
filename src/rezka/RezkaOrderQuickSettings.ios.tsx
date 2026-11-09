import { Host, Text, Toggle, VStack } from '@expo/ui/swift-ui';
import { accessibilityIdentifier, disabled, font, foregroundStyle } from '@expo/ui/swift-ui/modifiers';
import { PlatformColor, View } from 'react-native';
import { quickSettingsVisibility, showRezkaOrderConfirmation } from './rezkaOrderQuickSettingsCommon';
import type { RezkaOrderQuickSettingsProps } from './rezkaOrderQuickSettingsTypes';
import type { RezkaOrderOption } from './rezkaOrderSettingsController';
import { useRezkaOrderSettings, useRezkaOrderText } from './useRezkaOrderSettings';

function QuickSettingsBody({ showWorkOptions, ...props }: RezkaOrderQuickSettingsProps & { showWorkOptions: boolean }) {
  const { controller, state } = useRezkaOrderSettings(props, showWorkOptions), text = useRezkaOrderText();
  if (!state.values) return null;
  const values = state.values, enabled = !state.pending && !state.saving && !state.needsReopen;
  const change = (option: RezkaOrderOption, value: boolean) => {
    if (enabled) showRezkaOrderConfirmation(controller, option, value, text);
  };
  return <View><Host matchContents={{ vertical: true }}><VStack alignment="leading" spacing={8}>
    <Text modifiers={[font({ textStyle: 'title2' })]}>{text.admin('rezka_master.order_settings')}</Text>
    {showWorkOptions ? <>
      <Toggle isOn={values.duplicateLabels} onIsOnChange={value => change('duplicateLabels', value)}
        modifiers={[disabled(!enabled), accessibilityIdentifier('calculate-duplicate-rezka-labels')]}>
        <Text>{text.admin('calculate.duplicate_rezka_labels')}</Text><Text>{text.admin('calculate.duplicate_rezka_labels_hint')}</Text>
      </Toggle>
      <Toggle isOn={values.includeBobina} onIsOnChange={value => change('includeBobina', value)}
        modifiers={[disabled(!enabled), accessibilityIdentifier('calculate-include-bobina-in-net')]}>
        <Text>{text.admin('calculate.include_bobina_in_net')}</Text><Text>{text.admin('calculate.include_bobina_in_net_hint')}</Text>
      </Toggle>
    </> : null}
    <Toggle isOn={values.standardPrintSide} onIsOnChange={value => change('printSide', value)}
      modifiers={[disabled(!enabled), accessibilityIdentifier('rezka-master-print-side')]}>
      <Text>{text.production('order.print_side')}</Text>
      <Text>{text.production(values.standardPrintSide ? 'order.print_side.standard' : 'order.print_side.nonstandard')}</Text>
    </Toggle>
    {state.error ? <Text modifiers={[foregroundStyle(PlatformColor('systemRed'))]}>{text.error(state.error)}</Text> : null}
  </VStack></Host></View>;
}

/** Unconnected content for the existing worker order sheet, not a separate route. */
export function RezkaOrderQuickSettings(props: RezkaOrderQuickSettingsProps) {
  const visibility = quickSettingsVisibility(props);
  return visibility.showPrintSide ? <QuickSettingsBody {...props} showWorkOptions={visibility.showWorkOptions} /> : null;
}
