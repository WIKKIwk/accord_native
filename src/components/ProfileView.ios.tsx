import { BottomSheet, Button, Group, Host, HStack, Image, List, Menu, RNHostView, ScrollView, Section, Spacer, Text, TextField, useNativeState, VStack, ZStack } from '@expo/ui/swift-ui';
import { accessibilityLabel, background, buttonStyle, contentShape, disabled, font, foregroundStyle, frame, interactiveDismissDisabled, layoutPriority, listRowBackground, listRowSeparator, listStyle, menuIndicator, menuOrder, multilineTextAlignment, offset, padding, presentationCornerRadius, presentationDetents, presentationDragIndicator, shapes, strokeBorder, textInputAutocapitalization } from '@expo/ui/swift-ui/modifiers';
import type { ComponentProps } from 'react';
import { useColorScheme } from 'react-native';
import { profileDisplay } from '../profileModel';
import { ProfileAvatar } from './ProfileAvatar';
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

function ProfileEditor({ session, snapshot, avatarToken, avatarRevision, draftName, draftPhoto, busy, saving,
  onChangeName, onChoosePhoto, onSave, onCloseEditor }: ProfileViewProps) {
  const dark = useColorScheme() === 'dark';
  const name = useNativeState(draftName);
  return <Group modifiers={[
    presentationDetents([{ fraction: 0.72 }, 'large']), presentationDragIndicator('visible'),
    presentationCornerRadius(28), interactiveDismissDisabled(busy),
  ]}>
    <ScrollView modifiers={[frame({ maxWidth: Infinity, maxHeight: Infinity, alignment: 'top' })]}>
      <VStack alignment="center" spacing={20} modifiers={[frame({ maxWidth: Infinity }), padding({ horizontal: 24, top: 24, bottom: 28 })]}>
        <Text modifiers={[font({ textStyle: 'headline', weight: 'semibold' })]}>Profilni tahrirlash</Text>
        <Menu label={
          <ZStack alignment="bottomTrailing" modifiers={[contentShape(shapes.rectangle(), ['interaction', 'contextMenuPreview'])]}>
            <RNHostView matchContents><ProfileAvatar session={session} profile={snapshot.profile} token={avatarToken}
              size={108} revision={avatarRevision} previewUri={draftPhoto} /></RNHostView>
            <Image systemName="camera" size={17} color="#ffffff" modifiers={[
              frame({ width: 34, height: 34 }), background('#000000', shapes.circle()),
            ]} />
          </ZStack>
        } modifiers={[buttonStyle('plain'), menuIndicator('hidden'), menuOrder('fixed'), accessibilityLabel('Profil rasmini tanlash'), disabled(busy)]}>
          <Button label="Rasmlar" systemImage="photo.on.rectangle" onPress={() => onChoosePhoto('library')} />
          <Button label="Suratga olish" systemImage="camera" onPress={() => onChoosePhoto('camera')} />
          <Button label="Fayl tanlash" systemImage="folder" onPress={() => onChoosePhoto('file')} />
        </Menu>
        <VStack alignment="leading" spacing={8} modifiers={[frame({ maxWidth: Infinity, alignment: 'leading' })]}>
          <Text modifiers={[font({ textStyle: 'subheadline' }), secondary]}>Ism</Text>
          <TextField text={name} onTextChange={onChangeName} placeholder="Ismingiz" maxLength={100} modifiers={[
            font({ textStyle: 'body' }), textInputAutocapitalization('words'), padding({ horizontal: 16, vertical: 14 }),
            frame({ maxWidth: Infinity }),
            strokeBorder({ shape: 'roundedRectangle', cornerRadius: 18, content: dark ? '#5c5c60' : '#c7c7cc', style: { lineWidth: 1 } }),
            accessibilityLabel('Ism'), disabled(busy),
          ]} />
        </VStack>
        <Text modifiers={[font({ textStyle: 'footnote' }), secondary, frame({ maxWidth: Infinity, alignment: 'leading' }), multilineTextAlignment('leading')]}>Bu ism profilingizda boshqalarga ko‘rinadi.</Text>
        <Button label={saving ? 'Saqlanmoqda…' : 'Saqlash'} onPress={onSave} modifiers={[
          buttonStyle('plain'), font({ textStyle: 'body', weight: 'semibold' }),
          foregroundStyle(dark ? '#000000' : '#ffffff'), padding({ horizontal: 24, vertical: 12 }),
          background(dark ? '#ffffff' : '#1c1c1e', shapes.capsule()), disabled(saving),
        ]} />
        <Button label="Bekor qilish" onPress={onCloseEditor} modifiers={[buttonStyle('plain'), secondary, disabled(busy)]} />
      </VStack>
    </ScrollView>
  </Group>;
}

export function ProfileView(props: ProfileViewProps) {
  const { session, snapshot, avatarToken, avatarRevision, editing, busy, onOpenEditor, onCloseEditor, onLogout } = props;
  const details = profileDisplay(snapshot);
  const dark = useColorScheme() === 'dark';
  return <Host style={{ flex: 1 }}>
    <List modifiers={[listStyle('insetGrouped')]}>
      <HStack modifiers={[listRowBackground('transparent'), listRowSeparator('hidden'), padding({ vertical: 14 })]}>
        <Spacer />
        <VStack alignment="center" spacing={6}>
          <ZStack alignment="bottomTrailing">
            <RNHostView matchContents><ProfileAvatar session={session} profile={snapshot.profile} token={avatarToken} size={80} revision={avatarRevision} /></RNHostView>
            <BottomSheet isPresented={editing} onIsPresentedChange={(isPresented) => { if (!isPresented) onCloseEditor(); }}
              anchor={<Button onPress={onOpenEditor} modifiers={[
                buttonStyle('plain'), frame({ width: 32, height: 32 }),
                background(dark ? '#2c2c2e' : '#e5e5ea', shapes.circle()),
                strokeBorder({ shape: 'circle', content: dark ? '#000000' : '#f2f2f7', style: { lineWidth: 2 } }),
                padding({ all: 6 }), contentShape(shapes.rectangle()), offset({ x: 9, y: 9 }),
                accessibilityLabel('Profilni tahrirlash'), disabled(busy),
              ]}><Image systemName="pencil" size={15} color={dark ? '#ffffff' : '#1c1c1e'} /></Button>}>
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
        {details.legalName ? <ProfileRow icon="person.text.rectangle" title="To‘liq ism" value={details.legalName} /> : null}
        {details.phone ? <ProfileRow icon="phone" title="Telefon" value={details.phone} /> : null}
        {details.apparatusLabels.map((label, index) =>
          <ProfileRow key={`${label}-${index}`} icon="gearshape" title="Apparat" value={label} />)}
      </Section>
      <Section>
        <Button role="destructive" label="Hisobdan chiqish" systemImage="rectangle.portrait.and.arrow.right"
          onPress={onLogout} modifiers={[buttonStyle('plain')]} />
      </Section>
    </List>
  </Host>;
}
