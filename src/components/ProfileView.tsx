import { BottomSheet, Button, Column, FieldGroup, Host, RNHostView, Row, Spacer, Text, TextInput, useNativeState } from '@expo/ui';
import { useColorScheme } from 'react-native';
import { profileDisplay } from '../profileModel';
import { ProfileAvatar } from './ProfileAvatar';
import type { ProfileViewProps } from './profileViewTypes';

function ProfileEditor({ session, snapshot, avatarToken, avatarRevision, draftName, draftPhoto, busy, saving,
  onChangeName, onChoosePhoto, onSave, onCloseEditor }: ProfileViewProps) {
  const name = useNativeState(draftName);
  return <Column spacing={12}>
    <Text textStyle={{ fontSize: 20, fontWeight: '600' }}>Profilni tahrirlash</Text>
    <RNHostView matchContents><ProfileAvatar session={session} profile={snapshot.profile} token={avatarToken}
      size={90} revision={avatarRevision} previewUri={draftPhoto} /></RNHostView>
    <Button label="Rasmlar" variant="text" disabled={busy} onPress={() => onChoosePhoto('library')} />
    <Button label="Suratga olish" variant="text" disabled={busy} onPress={() => onChoosePhoto('camera')} />
    <Button label="Fayl tanlash" variant="text" disabled={busy} onPress={() => onChoosePhoto('file')} />
    <Text>Ism</Text>
    <TextInput value={name} onChangeText={onChangeName} editable={!busy} placeholder="Ismingiz" accessibilityLabel="Ism" />
    <Button label={saving ? 'Saqlanmoqda…' : 'Saqlash'} disabled={busy} onPress={onSave} />
    <Button label="Bekor qilish" variant="text" disabled={busy} onPress={onCloseEditor} />
  </Column>;
}

export function ProfileView(props: ProfileViewProps) {
  const { session, snapshot, avatarToken, avatarRevision, editing, busy, onOpenEditor, onCloseEditor, onLogout } = props;
  const muted = useColorScheme() === 'dark' ? '#aeaeb2' : '#6d6d72';
  const details = profileDisplay(snapshot);
  return <>
    <Host style={{ flex: 1 }}>
      <FieldGroup>
        <FieldGroup.Section title="Profil">
          <Row spacing={16} alignment="center" style={{ paddingVertical: 8 }}>
            <RNHostView matchContents><ProfileAvatar session={session} profile={snapshot.profile} token={avatarToken} revision={avatarRevision} /></RNHostView>
            <Column spacing={4}>
              <Text textStyle={{ fontSize: 20, fontWeight: '600' }}>{details.name}</Text>
              <Text textStyle={{ fontSize: 15, color: muted }}>{details.role}</Text>
            </Column>
          </Row>
          <Button label="Profilni tahrirlash" disabled={busy} onPress={onOpenEditor} />
          {details.legalName ? <Row spacing={12} style={{ width: '100%' }}>
            <Text>To‘liq ism</Text><Spacer flexible /><Text textStyle={{ color: muted }}>{details.legalName}</Text>
          </Row> : null}
          {details.phone ? <Row spacing={12} style={{ width: '100%' }}>
            <Text>Telefon</Text><Spacer flexible /><Text textStyle={{ color: muted }}>{details.phone}</Text>
          </Row> : null}
          {details.apparatusLabels.map((label, index) => <Row key={`${label}-${index}`} spacing={12} style={{ width: '100%' }}>
            <Text>Apparat</Text><Spacer flexible /><Text textStyle={{ color: muted }}>{label}</Text>
          </Row>)}
        </FieldGroup.Section>
        <FieldGroup.Section>
          <Button label="Hisobdan chiqish" variant="outlined" onPress={onLogout} />
        </FieldGroup.Section>
      </FieldGroup>
    </Host>
    <BottomSheet isPresented={editing} onDismiss={onCloseEditor} shouldDismissOnBackPress={!busy} shouldDismissOnClickOutside={!busy}>
      {editing ? <ProfileEditor {...props} /> : null}
    </BottomSheet>
  </>;
}
