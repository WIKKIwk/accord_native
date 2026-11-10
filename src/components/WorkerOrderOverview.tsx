import { Column, Host, ListItem, RNHostView, Text } from '@expo/ui';
import { SymbolView } from 'expo-symbols';
import { StyleSheet, View } from 'react-native';
import { useWorkerColors } from './useWorkerColors';
import { useWorkerOrderOverview, type WorkerOrderOverviewProps } from './useWorkerOrderOverview';

export function WorkerOrderOverview(props: WorkerOrderOverviewProps) {
  const model = useWorkerOrderOverview(props);
  const colors = useWorkerColors();
  return <>
    <View style={[styles.card, { backgroundColor: colors.surface }]}>
      <Host matchContents={{ vertical: true }} style={styles.host}>
        <Column>
          <ListItem testID="worker-order-summary" supportingText={model.subtitle}
            onPress={model.enabled ? model.toggle : undefined}
            trailing={<RNHostView matchContents><SymbolView size={22} tintColor={colors.icon}
              name={{ android: model.expanded ? 'expand_less' : 'expand_more', ios: model.expanded ? 'chevron.up' : 'chevron.down' }} />
            </RNHostView>}>
            {model.title}
          </ListItem>
          {model.expanded && model.enabled && <>
            {model.metrics.map(row => <ListItem key={row.id} supportingText={`${row.value} ${row.unit}`}>{row.label}</ListItem>)}
            {model.facts.map(row => <ListItem key={row.id} supportingText={row.value}>{row.label}</ListItem>)}
          </>}
        </Column>
      </Host>
    </View>
    {model.expanded && model.stages.length ? <View style={[styles.card, { backgroundColor: colors.surface }]}>
      <Host matchContents={{ vertical: true }} style={styles.host}>
        <Column>
          {model.stages.map(stage => <ListItem key={stage.id}
            leading={<Text>{String(stage.number)}</Text>} supportingText={stage.stateLabel}
            onPress={stage.apparatusId ? () => model.openStage(stage.apparatusId) : undefined}>
            {stage.title}
          </ListItem>)}
        </Column>
      </Host>
    </View> : null}
  </>;
}

const styles = StyleSheet.create({
  card: { borderRadius: 18, overflow: 'hidden' },
  host: { width: '100%' },
});
