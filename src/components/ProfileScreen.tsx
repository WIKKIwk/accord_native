import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Alert, AppState, Platform } from 'react-native';
import { activeSessionToken, type Session } from '../auth';
import { AvatarUploadError, uploadProfileAvatar } from '../profileAvatarUpload';
import { initialProfileSnapshot, profileDisplay, profileSnapshotFromResponse } from '../profileModel';
import { updateProfileName } from '../profileNameUpdate';
import { profile } from '../profileApi';
import { profileNickname, saveProfileChanges } from '../shared/profileEditing';
import { cachedProfileAvatar, ensureProfileAvatar, refreshProfileAvatar } from '../shared/profileAvatarRuntime';
import { isProfileSessionCurrent, type ProfileSessionGuard } from '../shared/profileSessionGuard';
import { localizedGetter } from '../shared/localization';
import { localeController } from '../shared/localization/runtime';
import { ProfileView } from './ProfileView';
import type { AvatarSource } from './profileViewTypes';

type Props = { session: Session; onLogout: () => void; onDailyWork?: () => void; showDirectLogout?: boolean;
  registerSettingsOpener?: (open: () => void) => () => void; isCurrent?: ProfileSessionGuard; settingsUnavailableMessage?: string };
const subscribeLocale = (listener: () => void) => localeController.addListener(listener);
const currentLocale = () => localeController.locale;

function showError(title: string, message: string) {
  if (Platform.OS === 'web') globalThis.alert(`${title}. ${message}`);
  else Alert.alert(title, message);
}

export function ProfileScreen(props: Props) {
  return <ProfileContent key={props.session.imageCacheScope} {...props} />;
}

function ProfileContent({ session, onLogout, onDailyWork, showDirectLogout, registerSettingsOpener, isCurrent, settingsUnavailableMessage }: Props) {
  const locale = useSyncExternalStore(subscribeLocale, currentLocale, currentLocale), hasGuard = isCurrent != null;
  const [snapshot, setSnapshot] = useState(() => initialProfileSnapshot(session));
  const [avatarToken, setAvatarToken] = useState(() => activeSessionToken(session));
  const [avatarRevision, setAvatarRevision] = useState(0);
  const [cachedAvatar, setCachedAvatar] = useState(() => hasGuard
    ? cachedProfileAvatar(session, session.profile, isCurrent) : cachedProfileAvatar(session, session.profile));
  const [editing, setEditing] = useState(false);
  const [draftName, setDraftName] = useState('');
  const [draftPhoto, setDraftPhoto] = useState<{ uri: string; filename?: string } | null>(null);
  const [pendingPhoto, setPendingPhoto] = useState<{ uri: string; filename?: string } | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const busy = useRef(false);
  const savingRef = useRef(false);
  const editorGeneration = useRef(0);
  const mounted = useRef(true);
  const readGeneration = useRef(0);
  const operationController = useRef<AbortController | null>(null);
  const refreshingRef = useRef(false);
  const current = useCallback(() => !!activeSessionToken(session) && isProfileSessionCurrent(isCurrent), [session, isCurrent]);

  useEffect(() => {
    mounted.current = true;
    const initialProfile = session.profile;
    const avatar = hasGuard ? ensureProfileAvatar(session, initialProfile, isCurrent) : ensureProfileAvatar(session, initialProfile);
    void avatar.then(uri => {
      if (mounted.current && current() && session.profile.avatar_url === initialProfile.avatar_url) setCachedAvatar(uri);
    });
    return () => { mounted.current = false; operationController.current?.abort(); };
  }, [session, isCurrent, current, hasGuard]);

  const refresh = useCallback(async () => {
    if (busy.current || refreshingRef.current || !current()) return;
    refreshingRef.current = true;
    setRefreshing(true);
    const generation = readGeneration.current;
    try {
      const next = profileSnapshotFromResponse(session, hasGuard ? await profile(session, false, isCurrent) : await profile(session));
      if (!mounted.current || generation !== readGeneration.current || !current() || !next) return;
      const avatar = hasGuard ? await refreshProfileAvatar(session, next.profile, isCurrent) : await refreshProfileAvatar(session, next.profile);
      if (!mounted.current || generation !== readGeneration.current || !current()) return;
      setSnapshot(next);
      setCachedAvatar(avatar);
      setAvatarToken(activeSessionToken(session));
    } catch { /* Keep the last known profile when refresh fails. */ }
    finally { refreshingRef.current = false; if (mounted.current && (!hasGuard || current())) setRefreshing(false); }
  }, [session, isCurrent, current, hasGuard]);

  useFocusEffect(useCallback(() => { void refresh(); }, [refresh]));
  useEffect(() => {
    const listener = AppState.addEventListener('change', state => { if (state === 'active') void refresh(); });
    return () => listener.remove();
  }, [refresh]);

  const openEditor = useCallback(() => {
    if (busy.current || !current()) return;
    readGeneration.current++;
    editorGeneration.current++;
    setDraftName(profileDisplay(snapshot).name);
    setDraftPhoto(pendingPhoto);
    setEditing(true);
  }, [pendingPhoto, snapshot, current]);

  const closeEditor = useCallback(() => {
    if (savingRef.current && Platform.OS !== 'android') return;
    editorGeneration.current++;
    setEditing(false);
    setDraftPhoto(pendingPhoto);
  }, [pendingPhoto]);

  const choosePhoto = useCallback(async (source: AvatarSource) => {
    if (busy.current || !current()) return;
    busy.current = true;
    const generation = editorGeneration.current;
    try {
      let uri: string | undefined, filename: string | undefined;
      if (source === 'file') {
        const result = await DocumentPicker.getDocumentAsync({ type: 'image/*', copyToCacheDirectory: true, multiple: false, base64: false });
        if (!result.canceled) { uri = result.assets[0]?.uri; filename = result.assets[0]?.name; }
      } else {
        if (source === 'camera' && Platform.OS !== 'web') {
          const permission = await ImagePicker.requestCameraPermissionsAsync();
          if (!permission.granted) throw new AvatarUploadError('Kameradan foydalanishga ruxsat bering.');
          if (hasGuard && !current()) return;
        }
        // The iOS library uses the modern picker and copies the photo without re-encoding it.
        const options: ImagePicker.ImagePickerOptions = source === 'library'
          ? { mediaTypes: ['images'], allowsEditing: false, quality: 1, preferredAssetRepresentationMode: ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Current }
          : { mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.82 };
        const result = source === 'camera'
          ? await ImagePicker.launchCameraAsync(options)
          : await ImagePicker.launchImageLibraryAsync(options);
        if (!result.canceled) { uri = result.assets[0]?.uri; filename = result.assets[0]?.fileName ?? undefined; }
      }
      if (uri && mounted.current && generation === editorGeneration.current && current()) setDraftPhoto({ uri, filename });
    } catch (error) {
      if (mounted.current && generation === editorGeneration.current && current()) {
        showError(localizedGetter('imagePickFailed', locale), error instanceof AvatarUploadError ? error.message : localizedGetter('retry', locale));
      }
    } finally {
      busy.current = false;
    }
  }, [locale, current, hasGuard]);

  const save = useCallback(async () => {
    if (busy.current || !current()) return;
    const name = profileNickname(draftName, profileDisplay(snapshot).name);
    if (name === profileDisplay(snapshot).name && !draftPhoto) { closeEditor(); return; }

    busy.current = true;
    savingRef.current = true;
    readGeneration.current++;
    setIsBusy(true);
    setSaving(true);
    const controller = new AbortController();
    operationController.current = controller;
    setPendingPhoto(draftPhoto);
    editorGeneration.current++;
    setEditing(false);
    try {
      const active = () => mounted.current && !controller.signal.aborted && current();
      const error = await saveProfileChanges(name !== profileDisplay(snapshot).name ? async () => {
        const next = hasGuard ? await updateProfileName(session, name, controller.signal, isCurrent) : await updateProfileName(session, name, controller.signal);
        if (active()) { setSnapshot(next); setAvatarToken(activeSessionToken(session)); }
      } : null, draftPhoto ? async () => {
        const next = hasGuard ? await uploadProfileAvatar(session, draftPhoto.uri, controller.signal, draftPhoto.filename, isCurrent)
          : await uploadProfileAvatar(session, draftPhoto.uri, controller.signal, draftPhoto.filename);
        if (active()) {
          const avatar = hasGuard ? await refreshProfileAvatar(session, next.profile, isCurrent) : await refreshProfileAvatar(session, next.profile);
          if (!active()) return;
          setSnapshot(next); setAvatarToken(activeSessionToken(session));
          setCachedAvatar(avatar ?? (hasGuard ? cachedProfileAvatar(session, next.profile, isCurrent) : cachedProfileAvatar(session, next.profile)));
          setAvatarRevision(revision => revision + 1); setPendingPhoto(null); setDraftPhoto(null);
        }
      } : null, active);
      if (error && active()) showError(localizedGetter(error === 'nickname' ? 'nicknameSaveFailed' : 'imageSaveFailed', locale), localizedGetter('retry', locale));
    } finally {
      if (operationController.current === controller) operationController.current = null;
      busy.current = false;
      savingRef.current = false;
      if (mounted.current && (!hasGuard || current())) { setIsBusy(false); setSaving(false); }
    }
  }, [closeEditor, draftName, draftPhoto, locale, session, snapshot, isCurrent, current, hasGuard]);
  const changeDraftName = useCallback((value: string) => { if (!hasGuard || current()) setDraftName(value); }, [current, hasGuard]);

  if (hasGuard && !current()) return null;
  return <ProfileView session={session} snapshot={snapshot} avatarToken={avatarToken} avatarRevision={avatarRevision} cachedAvatar={cachedAvatar}
    editing={editing} busy={isBusy} saving={saving} refreshing={refreshing} onRefresh={refresh} draftName={draftName} draftPhoto={draftPhoto?.uri ?? null}
    onOpenEditor={openEditor} onCloseEditor={closeEditor} onChangeName={changeDraftName}
    onChoosePhoto={choosePhoto} onSave={save} onDailyWork={onDailyWork} onLogout={onLogout} showDirectLogout={showDirectLogout}
    registerSettingsOpener={registerSettingsOpener} settingsUnavailableMessage={settingsUnavailableMessage} />;
}
