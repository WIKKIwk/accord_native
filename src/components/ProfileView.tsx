import { BottomSheet, Button, Column, FieldGroup, Host, RNHostView, Row, Spacer, Text, TextInput, useNativeState } from '@expo/ui';
import { useState } from 'react';
import { useColorScheme } from 'react-native';
import { profileDisplay } from '../profileModel';
import { ProfileAvatar } from './ProfileAvatar';
import { ProfileSettings } from './ProfileSettings';
import type { ProfileViewProps } from './profileViewTypes';

function ProfileEditor({ session, snapshot, avatarToken, avatarRevision, cachedAvatar, draftName, draftPhoto, busy, saving,
  onChangeName, onChoosePhoto, onSave, onCloseEditor }: ProfileViewProps) {
  const name = useNativeState(draftName);
  return <Column spacing={12}>
    <Text textStyle={{ fontSize: 20, fontWeight: '600' }}>Profilni tahrirlash</Text>
    <RNHostView matchContents><ProfileAvatar session={session} profile={snapshot.profile} token={avatarToken}
      size={90} revision={avatarRevision} previewUri={draftPhoto} cachedUri={cachedAvatar} /></RNHostView>
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
  const { session, snapshot, avatarToken, avatarRevision, editing, busy, onOpenEditor, onCloseEditor, onDailyWork, onLogout } = props;
  const muted = useColorScheme() === 'dark' ? '#aeaeb2' : '#6d6d72';
  const [apparatusExpanded, setApparatusExpanded] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const details = profileDisplay(snapshot);
  return <>
    <Host style={{ flex: 1 }}>
      <FieldGroup>
        <FieldGroup.Section title="Profil">
          <Row spacing={16} alignment="center" style={{ paddingVertical: 8 }}>
            <RNHostView matchContents><ProfileAvatar session={session} profile={snapshot.profile} token={avatarToken} revision={avatarRevision} cachedUri={props.cachedAvatar} /></RNHostView>
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
          {details.apparatusLabels.length === 1 ? <Row spacing={12} style={{ width: '100%' }}>
            <Text>Apparat</Text><Spacer flexible /><Text textStyle={{ color: muted }}>{details.apparatusLabels[0]}</Text>
          </Row> : null}
          {details.apparatusLabels.length > 1 ? <Column spacing={10} style={{ width: '100%' }}>
            <Row spacing={12} style={{ width: '100%' }} onPress={() => setApparatusExpanded(value => !value)}>
              <Text>Apparatlar</Text><Spacer flexible /><Text textStyle={{ color: muted }}>{`${details.apparatusLabels.length} ta`}</Text>
              <Text textStyle={{ color: muted }}>{apparatusExpanded ? '⌃' : '⌄'}</Text>
            </Row>
            {apparatusExpanded ? <Column spacing={8} style={{ width: '100%', paddingVertical: 4 }}>
              {details.apparatusLabels.map((label, index) => <Text key={`${label}-${index}`} textStyle={{ color: muted }}>{label}</Text>)}
            </Column> : null}
          </Column> : null}
        </FieldGroup.Section>
        <FieldGroup.Section>
          <Button label="Kunlik ish" variant="text" onPress={onDailyWork} />
          <Button label="Sozlamalar" variant="text" onPress={() => setSettingsOpen(true)} />
        </FieldGroup.Section>
        <FieldGroup.Section>
          <Button label="Hisobdan chiqish" variant="outlined" onPress={onLogout} />
        </FieldGroup.Section>
      </FieldGroup>
    </Host>
    <BottomSheet isPresented={editing} onDismiss={onCloseEditor} shouldDismissOnBackPress={!busy} shouldDismissOnClickOutside={!busy}>
      {editing ? <ProfileEditor {...props} /> : null}
    </BottomSheet>
    <BottomSheet isPresented={settingsOpen} onDismiss={() => setSettingsOpen(false)}>
      {settingsOpen ? <ProfileSettings session={session} onClose={() => setSettingsOpen(false)} onLogout={onLogout} /> : null}
    </BottomSheet>
  </>;
}
