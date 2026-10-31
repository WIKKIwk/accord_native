import { Button, FieldGroup, Host, Row, Spacer, Text } from '@expo/ui';
import type { Session } from '../auth';

type Props = { session: Session; onLogout: () => void };

export function WorkerProfile({ session, onLogout }: Props) {
  const displayName = String(session.profile.display_name ?? '').trim() || 'Aparatchi';
  const phone = String(session.profile.phone ?? '').trim();

  return <Host style={{ flex: 1 }}>
    <FieldGroup>
      <FieldGroup.Section title="Profil">
        <Text textStyle={{ fontSize: 20, fontWeight: '600' }}>{displayName}</Text>
        <Text>Aparatchi</Text>
        {!!phone && <Row spacing={12} style={{ width: '100%' }}>
          <Text>Telefon</Text><Spacer flexible /><Text>{phone}</Text>
        </Row>}
      </FieldGroup.Section>
      {session.assigned_apparatus_labels.length > 0 && <FieldGroup.Section title="Biriktirilgan aparatlar">
        {session.assigned_apparatus_labels.map((label, index) => <Text key={`${label}-${index}`}>{label}</Text>)}
      </FieldGroup.Section>}
      <FieldGroup.Section>
        <Button label="Hisobdan chiqish" variant="outlined" onPress={onLogout} />
      </FieldGroup.Section>
    </FieldGroup>
  </Host>;
}
