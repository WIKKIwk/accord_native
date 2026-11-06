import { Button, Column, FieldGroup, Host, ListItem, RNHostView, Row, ScrollView, Spacer, Text, TextInput, useNativeState } from '@expo/ui';
import { PullToRefreshBox } from '@expo/ui/jetpack-compose';
import { useCallback, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Alert, useColorScheme } from 'react-native';
import { profileDisplay } from '../profileModel';
import { useNativeSheet } from '../nativeSheet';
import { localizedGetter } from '../shared/localization';
import { localeController } from '../shared/localization/runtime';
import { ProfileAvatar } from './ProfileAvatar';
import { ProfileAvatarPreview } from './ProfileAvatarPreview.android';
import { ProfileSettings } from './ProfileSettings';
import type { ProfileViewProps } from './profileViewTypes';

const subscribeLocale = (listener: () => void) => localeController.addListener(listener);
const currentLocale = () => localeController.locale;

function ProfileEditor({ session, snapshot, avatarToken, avatarRevision, cachedAvatar, draftName, draftPhoto, busy, saving,
  onChangeName, onChoosePhoto, onSave }: ProfileViewProps) {
  const name = useNativeState(draftName);
  const locale = useSyncExternalStore(subscribeLocale, currentLocale, currentLocale);
  const t = (key: string) => localizedGetter(key, locale);
  return <Column spacing={16} style={{ padding: 12 }}>
    <Column spacing={6}>
      <Text textStyle={{ fontSize: 22, fontWeight: '600' }}>{t('profileEditTitle')}</Text>
      <Text>{t('profileEditBody')}</Text>
    </Column>
    <TextInput value={name} onChangeText={onChangeName} editable={!busy} autoFocus returnKeyType="done"
      placeholder={t('nicknameHint')} accessibilityLabel={t('nicknameLabel')} onSubmitEditing={() => { if (!busy) onSave(); }} />
    <ListItem supportingText={t(draftPhoto ? 'changeImage' : 'chooseImage')}
      onPress={busy ? undefined : () => onChoosePhoto('library')}
      leading={<RNHostView matchContents><ProfileAvatar session={session} profile={snapshot.profile} token={avatarToken}
        size={48} revision={avatarRevision} previewUri={draftPhoto} cachedUri={cachedAvatar} /></RNHostView>}>
      {t('profilePhotoTitle')}
    </ListItem>
    {draftPhoto ? <Text>{t('selectedImageNotice')}</Text> : null}
    <Button label={t(saving ? 'pinSaving' : 'save')} disabled={busy} onPress={onSave} testID="profile-save" />
  </Column>;
}

// @v2 ProfileScreen
export function ProfileView(props: ProfileViewProps) {
  const { session, snapshot, avatarToken, avatarRevision, editing, busy, onOpenEditor, onCloseEditor, onDailyWork, onLogout } = props;
  const locale = useSyncExternalStore(subscribeLocale, currentLocale, currentLocale);
  const muted = useColorScheme() === 'dark' ? '#aeaeb2' : '#6d6d72';
  const [apparatusExpanded, setApparatusExpanded] = useState(false);
  const editorSheet = useNativeSheet();
  const settingsSheet = useNativeSheet();
  const disconnectPending = useRef(false);
  const requestDisconnect = useCallback(() => {
    disconnectPending.current = true;
    settingsSheet.close();
  }, [settingsSheet]);
  const settingsDismissed = useCallback(() => {
    if (!disconnectPending.current) return;
    disconnectPending.current = false;
    const t = (key: string) => localizedGetter(key, locale);
    Alert.alert(t('disconnectSessionTitle'), t('disconnectSessionPrompt'), [
      { text: t('no'), style: 'cancel' },
      { text: t('disconnectSessionConfirm'), style: 'destructive', onPress: onLogout },
    ]);
  }, [locale, onLogout]);
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
        <ProfileSettings session={session} onClose={settingsSheet.close} onLogout={requestDisconnect} />
      </Host>, { dismissible: true, onDismiss: settingsDismissed });
    }
  }, [editing, busy, props, onCloseEditor, requestDisconnect, settingsDismissed, editorSheet, settingsSheet]);
  const openSettings = () => settingsSheet.open(<Host style={{ flex: 1 }}>
    <ProfileSettings session={session} onClose={settingsSheet.close} onLogout={requestDisconnect} />
  </Host>, { dismissible: true, onDismiss: settingsDismissed });
  const details = profileDisplay(snapshot);
  return <Host style={{ flex: 1 }}>
    <PullToRefreshBox isRefreshing={props.refreshing} onRefresh={() => { void props.onRefresh(); }}><FieldGroup>
      <FieldGroup.Section title={localizedGetter('profileTitle', locale)}>
        <Row spacing={16} alignment="center" style={{ paddingVertical: 8 }}>
          <RNHostView matchContents><ProfileAvatarPreview session={session} profile={snapshot.profile} token={avatarToken}
            revision={avatarRevision} name={details.name} zoomLabel={localizedGetter('profileAvatarZoomLabel', locale)}
            closeLabel={localizedGetter('closeAction', locale)} cachedUri={props.cachedAvatar} /></RNHostView>
          <Column spacing={4}>
            <Text textStyle={{ fontSize: 20, fontWeight: '600' }}>{details.name}</Text>
            <Text textStyle={{ fontSize: 15, color: muted }}>{details.role}</Text>
          </Column>
        </Row>
        <Button label={localizedGetter('profileEditTitle', locale)} disabled={busy} onPress={onOpenEditor} testID="profile-edit" />
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
        <Button label={localizedGetter('profileSettingsTitle', locale)} variant="text" onPress={openSettings} testID="profile-settings" />
      </FieldGroup.Section>
      <FieldGroup.Section>
        <Button label="Hisobdan chiqish" variant="outlined" onPress={onLogout} />
      </FieldGroup.Section>
    </FieldGroup></PullToRefreshBox>
  </Host>;
}
