import { Button, Column, Host, List, ListItem, Text } from '@expo/ui';
import { StyleSheet, View } from 'react-native';
import type { Session } from '../auth';

type Props = { session: Session; onLogout: () => void };

export function WorkerProfile({ session, onLogout }: Props) {
  const displayName = String(session.profile.display_name ?? '').trim() || 'Aparatchi';
  const phone = String(session.profile.phone ?? '').trim();
  return (
    <View style={styles.container}>
      <Host colorScheme="light" matchContents style={styles.heading}>
        <Column spacing={6}>
          <Text textStyle={{ fontSize: 24, fontWeight: 'bold', color: '#20241e' }}>{displayName}</Text>
          <Text textStyle={{ color: '#667067' }}>Aparatchi</Text>
        </Column>
      </Host>
      <Host colorScheme="light" style={styles.list}>
        <List>
          {phone ? <ListItem supportingText={phone}>Telefon</ListItem> : null}
          {session.assigned_apparatus_labels.map((label, index) => <ListItem key={`${label}-${index}`} supportingText="Biriktirilgan aparat">{label}</ListItem>)}
        </List>
      </Host>
      <Host colorScheme="light" matchContents style={styles.logout}>
        <Button label="Hisobdan chiqish" variant="outlined" onPress={onLogout} />
      </Host>
    </View>
  );
}
const styles = StyleSheet.create({
  container: { flex: 1 }, heading: { padding: 20 }, list: { flex: 1 }, logout: { paddingHorizontal: 20, paddingBottom: 16 },
});
