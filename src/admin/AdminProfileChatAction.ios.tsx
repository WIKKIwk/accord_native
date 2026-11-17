import { Button, HStack, Image, ProgressView, Text } from '@expo/ui/swift-ui';
import { accessibilityIdentifier, buttonStyle, controlSize, disabled, frame } from '@expo/ui/swift-ui/modifiers';
import { BaseHost } from '../components/BaseHost.ios';
import { useAdminProfileChatAction, type AdminProfileChatActionProps } from './useAdminProfileChatAction';

export function AdminProfileChatAction(props: AdminProfileChatActionProps) {
  const model = useAdminProfileChatAction(props);
  if (!model.visible) return null;
  return <BaseHost matchContents><Button onPress={model.open} modifiers={[buttonStyle('bordered'), controlSize('regular'), frame({ minHeight: 44 }), disabled(model.busy), accessibilityIdentifier('admin-profile-chat-action')]}>
    <HStack spacing={8}>{model.busy ? <ProgressView /> : <Image systemName="message.fill" size={17} />}<Text>{model.label}</Text></HStack>
  </Button></BaseHost>;
}
