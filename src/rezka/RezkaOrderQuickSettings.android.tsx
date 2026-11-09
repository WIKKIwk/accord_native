import { Column, Host, Row, Switch, Text, useMaterialColors } from '@expo/ui/jetpack-compose';
import { fillMaxWidth, semantics, testID, toggleable, weight } from '@expo/ui/jetpack-compose/modifiers';
import { View } from 'react-native';
import { quickSettingsVisibility, showRezkaOrderConfirmation } from './rezkaOrderQuickSettingsCommon';
import type { RezkaOrderQuickSettingsProps } from './rezkaOrderQuickSettingsTypes';
import type { RezkaOrderOption } from './rezkaOrderSettingsController';
import { useRezkaOrderSettings, useRezkaOrderText } from './useRezkaOrderSettings';

function Option({ title, subtitle, value, enabled, id, change }: { title: string; subtitle: string; value: boolean; enabled: boolean;
  id: string; change: (value: boolean) => void }) {
  return <Row verticalAlignment="center" modifiers={[fillMaxWidth(), testID(id), semantics({ contentDescription: title }),
    toggleable(value, () => change(!value), { role: 'switch', enabled })]}>
    <Column modifiers={[weight(1)]}><Text>{title}</Text><Text style={{ typography: 'bodySmall' }}>{subtitle}</Text></Column>
    <Switch value={value} enabled={enabled} />
  </Row>;
}
function QuickSettingsBody({ showWorkOptions, ...props }: RezkaOrderQuickSettingsProps & { showWorkOptions: boolean }) {
  const { controller, state } = useRezkaOrderSettings(props, showWorkOptions), text = useRezkaOrderText(), colors = useMaterialColors();
  if (!state.values) return null;
  const values = state.values, enabled = !state.pending && !state.saving && !state.needsReopen;
  const change = (option: RezkaOrderOption, value: boolean) => {
    if (enabled) showRezkaOrderConfirmation(controller, option, value, text);
  };
  return <View><Host matchContents={{ vertical: true }} style={{ width: '100%' }}><Column>
    <Text style={{ typography: 'titleLarge' }}>{text.admin('rezka_master.order_settings')}</Text>
    {showWorkOptions ? <>
      <Option id="calculate-duplicate-rezka-labels" title={text.admin('calculate.duplicate_rezka_labels')}
        subtitle={text.admin('calculate.duplicate_rezka_labels_hint')} value={values.duplicateLabels} enabled={enabled} change={value => change('duplicateLabels', value)} />
      <Option id="calculate-include-bobina-in-net" title={text.admin('calculate.include_bobina_in_net')}
        subtitle={text.admin('calculate.include_bobina_in_net_hint')} value={values.includeBobina} enabled={enabled} change={value => change('includeBobina', value)} />
    </> : null}
    <Option id="rezka-master-print-side" title={text.production('order.print_side')}
      subtitle={text.production(values.standardPrintSide ? 'order.print_side.standard' : 'order.print_side.nonstandard')}
      value={values.standardPrintSide} enabled={enabled} change={value => change('printSide', value)} />
    {state.error ? <Text color={colors.error}>{text.error(state.error)}</Text> : null}
  </Column></Host></View>;
}

/** Unconnected content for the existing worker order sheet, not a separate route. */
export function RezkaOrderQuickSettings(props: RezkaOrderQuickSettingsProps) {
  const visibility = quickSettingsVisibility(props);
  return visibility.showPrintSide ? <QuickSettingsBody {...props} showWorkOptions={visibility.showWorkOptions} /> : null;
}
