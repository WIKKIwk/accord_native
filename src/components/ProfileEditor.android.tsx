import { Box, Button, Column, Icon, IconButton, OutlinedTextField, RNHostView, Row, Text, TextButton, useMaterialColors, useNativeState } from '@expo/ui/jetpack-compose';
import { background, clickable, clip, fillMaxWidth, padding, paddingAll, semantics, size, testID, verticalScroll, weight } from '@expo/ui/jetpack-compose/modifiers';
import { useSyncExternalStore } from 'react';
import { localizedGetter } from '../shared/localization';
import { localeController } from '../shared/localization/runtime';
import { ProfileAvatar } from './ProfileAvatar';
import type { ProfileViewProps } from './profileViewTypes';

const subscribeLocale = (listener: () => void) => localeController.addListener(listener);
const currentLocale = () => localeController.locale;

export function ProfileEditor({ session, snapshot, avatarToken, avatarRevision, cachedAvatar, draftName, draftPhoto, busy, saving,
  onChangeName, onChoosePhoto, onSave, onCloseEditor }: ProfileViewProps) {
  const name = useNativeState(draftName);
  const colors = useMaterialColors();
  const locale = useSyncExternalStore(subscribeLocale, currentLocale, currentLocale);
  const t = (key: string) => localizedGetter(key, locale);
  const choosePhoto = () => onChoosePhoto('library');
  return <Column horizontalAlignment="center" verticalArrangement={{ spacedBy: 16 }}
    modifiers={[fillMaxWidth(), verticalScroll(), padding(20, 8, 20, 28)]}>
    <Row verticalAlignment="center" modifiers={[fillMaxWidth()]}>
      <Text color={colors.onSurface} style={{ typography: 'titleLarge', fontWeight: '600' }} modifiers={[weight(1)]}>{t('profileEditTitle')}</Text>
      <IconButton enabled={!busy} onClick={onCloseEditor} modifiers={[semantics({ contentDescription: t('closeAction') })]}>
        <Icon source={require('../../assets/icons/gscale/close.xml')} size={22} tint={colors.onSurfaceVariant} />
      </IconButton>
    </Row>
    <Text color={colors.onSurfaceVariant} style={{ typography: 'bodyMedium' }} modifiers={[fillMaxWidth()]}>{t('profileEditBody')}</Text>
    <Box contentAlignment="bottomEnd" modifiers={[size(112, 112), ...(busy ? [] : [clickable(choosePhoto)]), semantics({ contentDescription: t('profilePhotoTitle') })]}>
      <RNHostView matchContents><ProfileAvatar session={session} profile={snapshot.profile} token={avatarToken}
        size={112} revision={avatarRevision} previewUri={draftPhoto} cachedUri={cachedAvatar} /></RNHostView>
      <Icon source={require('../../assets/icons/gscale/edit.xml')} size={20} tint={colors.onPrimaryContainer}
        modifiers={[size(36, 36), clip({ type: 'circle' }), background(colors.primaryContainer), paddingAll(8)]} />
    </Box>
    <TextButton enabled={!busy} onClick={choosePhoto}><Text>{t(draftPhoto ? 'changeImage' : 'chooseImage')}</Text></TextButton>
    <OutlinedTextField value={name} enabled={!busy} singleLine onValueChange={onChangeName}
      keyboardOptions={{ capitalization: 'words', imeAction: 'done' }} keyboardActions={{ onDone: () => { if (!busy) onSave(); } }}
      modifiers={[fillMaxWidth(), semantics({ contentDescription: t('nicknameLabel') })]}>
      <OutlinedTextField.Label><Text>{t('nicknameLabel')}</Text></OutlinedTextField.Label>
      <OutlinedTextField.Placeholder><Text>{t('nicknameHint')}</Text></OutlinedTextField.Placeholder>
    </OutlinedTextField>
    {draftPhoto ? <Text color={colors.onSurfaceVariant} style={{ typography: 'bodySmall' }} modifiers={[fillMaxWidth()]}>{t('selectedImageNotice')}</Text> : null}
    <Button enabled={!busy} onClick={onSave} modifiers={[fillMaxWidth(), testID('profile-save')]}><Text>{t(saving ? 'pinSaving' : 'save')}</Text></Button>
  </Column>;
}
