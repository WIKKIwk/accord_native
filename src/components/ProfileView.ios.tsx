import { BottomSheet, Button, DisclosureGroup, Group, HStack, Image, List, Menu, RNHostView, ScrollView, Section, Spacer, Text, TextField, useNativeState, VStack, ZStack } from '@expo/ui/swift-ui';
import { accessibilityLabel, background, buttonStyle, contentShape, disabled, font, foregroundStyle, frame, interactiveDismissDisabled, layoutPriority, listRowBackground, listRowSeparator, listStyle, menuIndicator, menuOrder, multilineTextAlignment, offset, padding, presentationCornerRadius, presentationDetents, presentationDragIndicator, refreshable, shapes, strokeBorder, textInputAutocapitalization } from '@expo/ui/swift-ui/modifiers';
import { useState, type ComponentProps } from 'react';
import { PlatformColor } from 'react-native';
import { profileDisplay } from '../profileModel';
import { themeController } from '../shared/themeRuntime';
import { ProfileAvatar } from './ProfileAvatar';
import { ProfileAvatarPreview } from './ProfileAvatarPreview.ios';
import { ProfileSettings } from './ProfileSettings.ios';
import { ProfileSettingsPreferences } from './ProfileSettingsPreferences.ios';
import { BaseHost as Host } from './BaseHost';
import { ProfileSwitchPin } from './ProfileSwitchPin.ios';
import { useBaseLocale } from './useBaseLocale.ios';
import { useSwitchPinSetup } from './useSwitchPinSetup.ios';
import type { ProfileViewProps } from './profileViewTypes';

type RowProps = { icon: ComponentProps<typeof Image>['systemName']; title: string; value: string };

const secondary = foregroundStyle({ type: 'hierarchical', style: 'secondary' });

function ProfileRow({ icon, title, value }: RowProps) {
  return <HStack spacing={12} modifiers={[padding({ vertical: 4 })]}>
    <Image systemName={icon} size={18} modifiers={[frame({ width: 22 }), secondary]} />
    <Text modifiers={[layoutPriority(1)]}>{title}</Text>
    <Spacer />
    <Text modifiers={[secondary, multilineTextAlignment('trailing')]}>{value}</Text>
  </HStack>;
}

function NavigationRow({ icon, title, onPress }: { icon: RowProps['icon']; title: string; onPress: () => void }) {
  return <Button onPress={onPress} modifiers={[buttonStyle('plain')]}>
    <HStack spacing={12} modifiers={[padding({ vertical: 4 }), frame({ maxWidth: Infinity }), contentShape(shapes.rectangle())]}>
      <Image systemName={icon} size={18} modifiers={[frame({ width: 22 }), secondary]} />
      <Text>{title}</Text><Spacer />
      <Image systemName="chevron.right" size={13} modifiers={[secondary]} />
    </HStack>
  </Button>;
}

function ApparatusRow({ labels }: { labels: string[] }) {
  const [expanded, setExpanded] = useState(false);
  if (!labels.length) return null;
  if (labels.length === 1) return <ProfileRow icon="gearshape" title="Apparat" value={labels[0]} />;

  return <DisclosureGroup isExpanded={expanded} onIsExpandedChange={setExpanded}>
    <DisclosureGroup.Label>
      <HStack spacing={12} modifiers={[padding({ vertical: 4 }), frame({ maxWidth: Infinity }), contentShape(shapes.rectangle())]}>
        <Image systemName="gearshape" size={18} modifiers={[frame({ width: 22 }), secondary]} />
        <Text>Apparatlar</Text>
        <Spacer />
        <Text modifiers={[secondary]}>{`${labels.length} ta`}</Text>
      </HStack>
    </DisclosureGroup.Label>
    {expanded ? <VStack alignment="leading" spacing={10} modifiers={[padding({ vertical: 8 }), frame({ maxWidth: Infinity, alignment: 'leading' })]}>
      {labels.map((label, index) => <Text key={`${label}-${index}`} modifiers={[secondary, frame({ maxWidth: Infinity, alignment: 'leading' })]}>{label}</Text>)}
    </VStack> : null}
  </DisclosureGroup>;
}

// @v2 _ProfileSelectionSheet
function ProfileEditor({ session, snapshot, avatarToken, avatarRevision, cachedAvatar, draftName, draftPhoto, busy, saving,
  onChangeName, onChoosePhoto, onSave, onCloseEditor }: ProfileViewProps) {
  const { text } = useBaseLocale();
  const name = useNativeState(draftName);
  return <Group modifiers={[
    presentationDetents([{ fraction: 0.72 }, 'large']), presentationDragIndicator('visible'),
    presentationCornerRadius(28), interactiveDismissDisabled(busy),
  ]}>
    <ScrollView modifiers={[frame({ maxWidth: Infinity, maxHeight: Infinity, alignment: 'top' })]}>
      <VStack alignment="center" spacing={20} modifiers={[frame({ maxWidth: Infinity }), padding({ horizontal: 24, top: 24, bottom: 28 })]}>
        <Text modifiers={[font({ textStyle: 'headline', weight: 'semibold' })]}>{text('profileEditTitle')}</Text>
        <Text modifiers={[font({ textStyle: 'footnote' }), secondary]}>{text('profileEditBody')}</Text>
        <Menu label={
          <ZStack alignment="bottomTrailing" modifiers={[contentShape(shapes.rectangle(), ['interaction', 'contextMenuPreview'])]}>
            <RNHostView matchContents><ProfileAvatar session={session} profile={snapshot.profile} token={avatarToken}
              size={108} revision={avatarRevision} previewUri={draftPhoto} cachedUri={cachedAvatar} /></RNHostView>
            <Image systemName="camera" size={17} color={PlatformColor('systemBackground')} modifiers={[
              frame({ width: 34, height: 34 }), background(PlatformColor('label'), shapes.circle()),
            ]} />
          </ZStack>
        } modifiers={[buttonStyle('plain'), menuIndicator('hidden'), menuOrder('fixed'), accessibilityLabel(text('profilePhotoTitle')), disabled(busy)]}>
          <Button label={text(draftPhoto ? 'changeImage' : 'chooseImage')} systemImage="photo.on.rectangle" onPress={() => onChoosePhoto('library')} />
          <Button label="Suratga olish" systemImage="camera" onPress={() => onChoosePhoto('camera')} />
          <Button label="Fayl tanlash" systemImage="folder" onPress={() => onChoosePhoto('file')} />
        </Menu>
        <VStack alignment="leading" spacing={8} modifiers={[frame({ maxWidth: Infinity, alignment: 'leading' })]}>
          <Text modifiers={[font({ textStyle: 'subheadline' }), secondary]}>{text('nicknameLabel')}</Text>
          <TextField text={name} onTextChange={onChangeName} placeholder={text('nicknameHint')} maxLength={100} modifiers={[
            font({ textStyle: 'body' }), textInputAutocapitalization('words'), padding({ horizontal: 16, vertical: 14 }),
            frame({ maxWidth: Infinity }),
            strokeBorder({ shape: 'roundedRectangle', cornerRadius: 18, content: PlatformColor('separator'), style: { lineWidth: 1 } }),
            accessibilityLabel(text('nicknameLabel')), disabled(busy),
          ]} />
        </VStack>
        {draftPhoto ? <Text modifiers={[font({ textStyle: 'footnote' }), secondary, frame({ maxWidth: Infinity, alignment: 'leading' }), multilineTextAlignment('leading')]}>{text('selectedImageNotice')}</Text> : null}
        <Button label={saving ? text('pinSaving') : text('save')} onPress={onSave} modifiers={[
          buttonStyle('plain'), font({ textStyle: 'body', weight: 'semibold' }),
          foregroundStyle(PlatformColor('systemBackground')), padding({ horizontal: 24, vertical: 12 }),
          background(PlatformColor('label'), shapes.capsule()), disabled(saving),
        ]} />
        <Button label="Bekor qilish" onPress={onCloseEditor} modifiers={[buttonStyle('plain'), secondary, disabled(busy)]} />
      </VStack>
    </ScrollView>
  </Group>;
}

// @v2 ProfileScreen
export function ProfileView(props: ProfileViewProps) {
  const { session, snapshot, avatarToken, avatarRevision, editing, busy, onOpenEditor, onCloseEditor, onDailyWork, onLogout, showDirectLogout } = props;
  const details = profileDisplay(snapshot);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [avatarOpen, setAvatarOpen] = useState(false);
  const { text } = useBaseLocale();
  const switchPin = useSwitchPinSetup(session);
  const closeSettings = () => { if (!switchPin.busy) { switchPin.close(); setSettingsOpen(false); } };
  return <><Host style={{ flex: 1 }}>
    <List modifiers={[listStyle('insetGrouped'), refreshable(props.onRefresh)]}>
      <HStack modifiers={[listRowBackground('transparent'), listRowSeparator('hidden'), padding({ vertical: 14 })]}>
        <Spacer />
        <VStack alignment="center" spacing={6}>
          <ZStack alignment="bottomTrailing">
            <Button onPress={() => setAvatarOpen(true)} modifiers={[buttonStyle('plain'), accessibilityLabel(text('profileAvatarZoomLabel'))]}>
              <RNHostView matchContents><ProfileAvatar session={session} profile={snapshot.profile} token={avatarToken} size={80} revision={avatarRevision} cachedUri={props.cachedAvatar} /></RNHostView>
            </Button>
            <BottomSheet isPresented={editing} onIsPresentedChange={(isPresented) => { if (!isPresented) onCloseEditor(); }}
              anchor={<Button onPress={onOpenEditor} modifiers={[
                buttonStyle('plain'), frame({ width: 32, height: 32 }),
                background(PlatformColor('systemGray5'), shapes.circle()),
                strokeBorder({ shape: 'circle', content: PlatformColor('systemGroupedBackground'), style: { lineWidth: 2 } }),
                padding({ all: 6 }), contentShape(shapes.rectangle()), offset({ x: 9, y: 9 }),
                accessibilityLabel(text('profileEditTitle')), disabled(busy),
              ]}><Image systemName="pencil" size={15} color={PlatformColor('label')} /></Button>}>
              <ProfileEditor {...props} />
            </BottomSheet>
          </ZStack>
          <VStack alignment="center" spacing={3} modifiers={[padding({ top: 4 })]}>
            <Text modifiers={[font({ textStyle: 'title3', weight: 'semibold' })]}>{details.name}</Text>
            <Text modifiers={[font({ textStyle: 'subheadline' }), secondary]}>{details.role}</Text>
          </VStack>
        </VStack>
        <Spacer />
      </HStack>
      <Section title="Hisob">
        {details.legalName ? <ProfileRow icon="person.text.rectangle" title={text('legalNameLabel')} value={details.legalName} /> : null}
        {details.phone ? <ProfileRow icon="phone" title={text('phoneLabel')} value={details.phone} /> : null}
        <ApparatusRow labels={details.apparatusLabels} />
      </Section>
      <Section>
        {onDailyWork ? <NavigationRow icon="calendar" title="Kunlik ish" onPress={onDailyWork} /> : null}
        <BottomSheet isPresented={settingsOpen} onIsPresentedChange={presented => { if (presented) setSettingsOpen(true); else closeSettings(); }}
          anchor={<NavigationRow icon="gearshape" title={text('profileSettingsTitle')} onPress={() => setSettingsOpen(true)} />}>
          <ProfileSettings onClose={closeSettings} onLogout={onLogout} translate={text}
            preferences={<ProfileSettingsPreferences />} switchPin={<ProfileSwitchPin pin={switchPin} />} switchPinBusy={switchPin.busy}
            onAppearanceChange={value => value === 'system' ? Promise.resolve() : themeController.setThemeMode(value)} />
        </BottomSheet>
      </Section>
      {showDirectLogout !== false ? <Section>
        <Button role="destructive" label={text('logoutTitle')} systemImage="rectangle.portrait.and.arrow.right"
          onPress={onLogout} modifiers={[buttonStyle('plain')]} />
      </Section> : null}
    </List>
  </Host>
  <ProfileAvatarPreview visible={avatarOpen} onClose={() => setAvatarOpen(false)} session={session} profile={snapshot.profile}
    token={avatarToken} revision={avatarRevision} displayName={details.name} cachedUri={props.cachedAvatar} />
  </>;
}
