import { Column as UniversalColumn, Host, ListItem, RNHostView as UniversalRNHostView, Text as UniversalText } from '@expo/ui';
import { Column, RNHostView, Row, Text } from '@expo/ui/jetpack-compose';
import { fillMaxWidth, padding, weight, width } from '@expo/ui/jetpack-compose/modifiers';
import { SymbolView } from 'expo-symbols';
import { StyleSheet, View } from 'react-native';
import { BaseHost } from './BaseHost';
import { useWorkerColors } from './useWorkerColors';
import { useWorkerOrderOverview, type WorkerOrderOverviewProps } from './useWorkerOrderOverview';

const rowIcons = { length: 'straighten', weight: 'scale', shafts: 'view_column', 'print-side': 'explore' } as const;

/** @v2 _OrderSummaryCard */
export function WorkerOrderOverview(props: WorkerOrderOverviewProps) {
  const model = useWorkerOrderOverview(props);
  const colors = useWorkerColors();
  const rows = [
    ...model.metrics.map(row => ({ ...row, value: `${row.value} ${row.unit}` })),
    ...model.facts,
  ];
  return <>
    <View style={[styles.card, { backgroundColor: colors.surface }]}>
      <Host matchContents={{ vertical: true }} style={styles.host}>
        <UniversalColumn>
          <ListItem testID="worker-order-summary" supportingText={model.subtitle}
            onPress={model.enabled ? model.toggle : undefined}
            trailing={<UniversalRNHostView matchContents><SymbolView size={22} tintColor={colors.icon}
              name={{ android: model.expanded ? 'expand_less' : 'expand_more' }} />
            </UniversalRNHostView>}>
            {model.title}
          </ListItem>
        </UniversalColumn>
      </Host>
      {model.expanded && model.enabled ? <BaseHost matchContents={{ vertical: true }} style={styles.host}>
        <Column modifiers={[fillMaxWidth(), padding(14, 0, 14, 14)]}>
          {rows.map(row => {
            const icon = rowIcons[row.id as keyof typeof rowIcons];
            return <Row key={row.id} verticalAlignment="top" horizontalArrangement={{ spacedBy: 10 }}
              modifiers={[fillMaxWidth(), padding(0, 7, 0, 7)]}>
              <Row verticalAlignment="center" horizontalArrangement={{ spacedBy: 6 }} modifiers={[width(104)]}>
                {icon ? <RNHostView matchContents><SymbolView name={{ android: icon }} size={16} tintColor={colors.muted} accessible={false} /></RNHostView> : null}
                <Text color={colors.muted} style={{ typography: 'bodySmall' }} modifiers={[weight(1)]}>{row.label}</Text>
              </Row>
              <Text color={colors.text} style={{ typography: 'bodyMedium',
                fontWeight: row.id === 'print-side' && props.detail?.map.standard_print_side !== false ? '500' : '700' }}
                modifiers={[weight(1)]}>{row.value}</Text>
            </Row>;
          })}
        </Column>
      </BaseHost> : null}
    </View>
    {model.expanded && model.stages.length ? <View style={[styles.card, { backgroundColor: colors.surface }]}>
      <Host matchContents={{ vertical: true }} style={styles.host}>
        <UniversalColumn>
          {model.stages.map(stage => <ListItem key={stage.id}
            leading={<UniversalText>{String(stage.number)}</UniversalText>} supportingText={stage.stateLabel}
            onPress={stage.apparatusId ? () => model.openStage(stage.apparatusId) : undefined}>
            {stage.title}
          </ListItem>)}
        </UniversalColumn>
      </Host>
    </View> : null}
  </>;
}

const styles = StyleSheet.create({
  card: { borderRadius: 18, overflow: 'hidden' },
  host: { width: '100%' },
});
