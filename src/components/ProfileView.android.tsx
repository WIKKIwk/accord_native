import { Button, Column, FieldGroup, Host, ListItem, RNHostView, Row, ScrollView, Spacer, Text, TextInput, useNativeState } from '@expo/ui';
import { useLayoutEffect, useState } from 'react';
import { useColorScheme } from 'react-native';
import { profileDisplay } from '../profileModel';
import { useNativeSheet } from '../nativeSheet';
import { ProfileAvatar } from './ProfileAvatar';
import { ProfileSettings } from './ProfileSettings';
import type { ProfileViewProps } from './profileViewTypes';

function ProfileEditor({ session, snapshot, avatarToken, avatarRevision, draftName, draftPhoto, busy, saving,
  onChangeName, onChoosePhoto, onSave }: ProfileViewProps) {
  const name = useNativeState(draftName);
  return <Column spacing={16} style={{ padding: 12 }}>
    <Column spacing={6}>
      <Text textStyle={{ fontSize: 22, fontWeight: '600' }}>Profilni tahrirlash</Text>
      <Text>Nickname va profil rasmini yangilang</Text>
    </Column>
    <TextInput value={name} onChangeText={onChangeName} editable={!busy} autoFocus returnKeyType="done"
      placeholder="Nickname" accessibilityLabel="Nickname" onSubmitEditing={() => { if (!busy) onSave(); }} />
    <ListItem supportingText={draftPhoto ? 'Almashtirish' : 'Rasm tanlash'}
      onPress={busy ? undefined : () => onChoosePhoto('library')}
      leading={<RNHostView matchContents><ProfileAvatar session={session} profile={snapshot.profile} token={avatarToken}
        size={48} revision={avatarRevision} previewUri={draftPhoto} /></RNHostView>}>
      Profil rasmi
    </ListItem>
    <Button label={saving ? 'Saqlanmoqda…' : 'Saqlash'} disabled={busy} onPress={onSave} />
  </Column>;
}

export function ProfileView(props: ProfileViewProps) {
  const { session, snapshot, avatarToken, avatarRevision, editing, busy, onOpenEditor, onCloseEditor, onDailyWork, onLogout } = props;
  const muted = useColorScheme() === 'dark' ? '#aeaeb2' : '#6d6d72';
  const [apparatusExpanded, setApparatusExpanded] = useState(false);
  const editorSheet = useNativeSheet();
  const settingsSheet = useNativeSheet();
  useLayoutEffect(() => {
    const content = <Host style={{ flex: 1 }}><ScrollView>
      <ProfileEditor {...props} />
    </ScrollView></Host>;
    if (editing) {
      const options = { dismissible: true, onDismiss: onCloseEditor };
      if (editorSheet.isOpen()) editorSheet.update(content, options);
      else editorSheet.open(content, options);
    } else if (editorSheet.isOpen()) {
      editorSheet.update(content, { dismissible: true, onDismiss: onCloseEditor });
      editorSheet.close();
    }
    if (settingsSheet.isOpen()) {
      settingsSheet.update(<Host style={{ flex: 1 }}>
        <ProfileSettings onClose={settingsSheet.close} onLogout={onLogout} />
      </Host>, { dismissible: true });
    }
  }, [editing, busy, props, onCloseEditor, onLogout, editorSheet, settingsSheet]);
  const openSettings = () => settingsSheet.open(<Host style={{ flex: 1 }}>
    <ProfileSettings onClose={settingsSheet.close} onLogout={onLogout} />
  </Host>, { dismissible: true });
  const details = profileDisplay(snapshot);
  return <Host style={{ flex: 1 }}>
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
        <Button label="Sozlamalar" variant="text" onPress={openSettings} />
      </FieldGroup.Section>
      <FieldGroup.Section>
        <Button label="Hisobdan chiqish" variant="outlined" onPress={onLogout} />
      </FieldGroup.Section>
    </FieldGroup>
  </Host>;
}
