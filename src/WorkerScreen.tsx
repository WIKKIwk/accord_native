import { Button, Column, Host, List, ListItem, Text, TextInput } from '@expo/ui';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, SafeAreaView, StyleSheet, View } from 'react-native';
import type { Session } from './auth';
import { loadWorkerQueue, type WorkerQueue } from './workerApi';
import { OrderScreen } from './OrderScreen';

type Props = { session: Session; onLogout: () => void };
const statusLabel: Record<string, string> = {
  pending: 'Kutilmoqda', waiting: 'Kutilmoqda', in_progress: 'Ish jarayonida',
  paused: 'To‘xtatilgan', completed: 'Yakunlangan', frozen: 'Muzlatilgan',
  print_preflight: 'Rang moslash',
};

export function WorkerScreen({ session, onLogout }: Props) {
  const [queue, setQueue] = useState<WorkerQueue | null>(null);
  const [machineId, setMachineId] = useState('');
  const [orderId, setOrderId] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const reload = useCallback(async (showLoading = false) => {
    if (showLoading) setLoading(true);
    try {
      const result = await loadWorkerQueue(session, search);
      setQueue(result);
      setMachineId(current => result.machines.some(machine => machine.id === current) ? current : (result.machines[0]?.id ?? ''));
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Navbatni yuklab bo‘lmadi.');
    } finally { setLoading(false); }
  }, [session, search]);
  useEffect(() => {
    const timer = setTimeout(() => { void reload(true); }, search ? 350 : 0);
    return () => clearTimeout(timer);
  }, [reload, search]);
  useEffect(() => {
    if (orderId) return;
    const timer = setInterval(() => { void reload(); }, 20000);
    return () => clearInterval(timer);
  }, [reload, orderId]);

  if (orderId && machineId) return <OrderScreen session={session} apparatusId={machineId} orderId={orderId} onClose={() => setOrderId('')} onChanged={() => { void reload(); }} />;
  const selectedMachine = queue?.machines.find(machine => machine.id === machineId);
  const orders = queue?.orders[machineId] ?? [];
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Host matchContents style={styles.host}>
          <Column spacing={8}>
            <Text textStyle={{ fontSize: 25, fontWeight: 'bold' }}>Ish navbati</Text>
            <Text textStyle={{ color: '#606b76' }}>{selectedMachine?.name ?? 'Bosma aparati'}</Text>
            <TextInput placeholder="Buyurtmani qidirish" onChangeText={setSearch} />
          </Column>
        </Host>
      </View>
      {loading && !queue ? <ActivityIndicator style={styles.loading} /> : null}
      <Host style={styles.list}>
        <List onRefresh={async () => { await reload(); }}>
          {error ? <ListItem supportingText={error} onPress={() => { void reload(true); }}>Qayta urinish</ListItem> : null}
          {queue && !queue.machines.length ? <ListItem supportingText="Administrator aparatni hisobingizga biriktirishi kerak.">Bosma aparati topilmadi</ListItem> : null}
          {(queue?.machines.length ?? 0) > 1 ? queue!.machines.map(machine => (
            <ListItem key={machine.id} supportingText={machine.id === machineId ? 'Tanlangan aparat' : 'Navbatni ko‘rish'} onPress={() => setMachineId(machine.id)}>{machine.name}</ListItem>
          )) : null}
          {selectedMachine && !orders.length && !loading ? <ListItem>Buyurtmalar topilmadi</ListItem> : null}
          {orders.map(order => (
            <ListItem key={order.id} supportingText={[order.customer, statusLabel[order.state] ?? order.state].filter(Boolean).join(' · ')} onPress={() => setOrderId(order.id)}>
              {[order.code, order.title].filter(Boolean).join(' · ')}
            </ListItem>
          ))}
        </List>
      </Host>
      <Host matchContents style={styles.footer}>
        <Column spacing={4}>
          <Button label="Yangilash" variant="outlined" onPress={() => { void reload(true); }} />
          <Button label="Chiqish" variant="text" onPress={onLogout} />
        </Column>
      </Host>
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f8f9fb' },
  header: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 12 },
  host: { width: '100%' },
  list: { flex: 1 },
  loading: { padding: 20 },
  footer: { width: '100%', paddingHorizontal: 20, paddingBottom: 14 },
});
