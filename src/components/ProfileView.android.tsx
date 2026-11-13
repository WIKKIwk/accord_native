import { Button, Column, FieldGroup, RNHostView, Row, Spacer, Text } from '@expo/ui';
import { PullToRefreshBox, useMaterialColors } from '@expo/ui/jetpack-compose';
import { useCallback, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Alert } from 'react-native';
import { profileDisplay } from '../profileModel';
import { useNativeSheet } from '../nativeSheet';
import { localizedGetter } from '../shared/localization';
import { localeController } from '../shared/localization/runtime';
import { ProfileAvatarPreview } from './ProfileAvatarPreview.android';
import { ProfileEditor } from './ProfileEditor.android';
import { ProfileSettings } from './ProfileSettings';
import { BaseHost as Host } from './BaseHost';
import type { ProfileViewProps } from './profileViewTypes';

const subscribeLocale = (listener: () => void) => localeController.addListener(listener);
const currentLocale = () => localeController.locale;

// @v2 ProfileScreen
export function ProfileView(props: ProfileViewProps) {
  const { session, snapshot, avatarToken, avatarRevision, editing, busy, onOpenEditor, onCloseEditor, onDailyWork, onLogout, showDirectLogout, settingsUnavailableMessage } = props;
  const locale = useSyncExternalStore(subscribeLocale, currentLocale, currentLocale);
  const colors = useMaterialColors({});
  const muted = colors.onSurfaceVariant;
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
    const content = <Host dynamicColors style={{ flex: 1 }}><ProfileEditor {...props} /></Host>;
    if (editing) {
      const options = { dismissible: true, heightFraction: 0.72, onDismiss: onCloseEditor };
      if (editorSheet.isOpen()) editorSheet.update(content, options);
      else editorSheet.open(content, options);
    } else if (editorSheet.isOpen()) {
      editorSheet.update(content, { dismissible: true, onDismiss: onCloseEditor });
      editorSheet.close();
    }
    if (settingsUnavailableMessage && settingsSheet.isOpen()) { disconnectPending.current = false; settingsSheet.close(); }
    if (!settingsUnavailableMessage && settingsSheet.isOpen()) {
      settingsSheet.update(<Host dynamicColors style={{ flex: 1 }}>
        <ProfileSettings session={session} onClose={settingsSheet.close} onLogout={requestDisconnect} />
      </Host>, { dismissible: true, onDismiss: settingsDismissed });
    }
  }, [editing, busy, props, session, onCloseEditor, requestDisconnect, settingsDismissed, editorSheet, settingsSheet, settingsUnavailableMessage]);
  const openSettings = () => { if (settingsUnavailableMessage) return; settingsSheet.open(<Host dynamicColors style={{ flex: 1 }}>
    <ProfileSettings session={session} onClose={settingsSheet.close} onLogout={requestDisconnect} />
  </Host>, { dismissible: true, onDismiss: settingsDismissed }); };
  const details = profileDisplay(snapshot);
  return <Host dynamicColors style={{ flex: 1 }}>
    <PullToRefreshBox isRefreshing={props.refreshing} onRefresh={() => { void props.onRefresh(); }}><FieldGroup
      style={{ backgroundColor: colors.surfaceContainerLow }}>
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
          <Text>{localizedGetter('legalNameLabel', locale)}</Text><Spacer flexible /><Text textStyle={{ color: muted }}>{details.legalName}</Text>
        </Row> : null}
        {details.phone ? <Row spacing={12} style={{ width: '100%' }}>
          <Text>{localizedGetter('phoneLabel', locale)}</Text><Spacer flexible /><Text textStyle={{ color: muted }}>{details.phone}</Text>
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
        {onDailyWork && session.profile.role !== 'tayyorlov_masteri' ? <Button label="Kunlik ish" variant="text" onPress={onDailyWork} /> : null}
        {settingsUnavailableMessage ? <Text>{settingsUnavailableMessage}</Text> :
          <Button label={localizedGetter('profileSettingsTitle', locale)} variant="text" onPress={openSettings} testID="profile-settings" />}
      </FieldGroup.Section>
      {showDirectLogout !== false ? <FieldGroup.Section>
        <Button label={localizedGetter('logoutTitle', locale)} variant="outlined" onPress={onLogout} />
      </FieldGroup.Section> : null}
    </FieldGroup></PullToRefreshBox>
  </Host>;
}
