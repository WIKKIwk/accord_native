import { Stack } from 'expo-router';
import { RoleDrawerButton } from '../../../shared/navigation/RoleDrawerButton';
import { useCustomerText } from '../../../customer/CustomerContext';
export default function CustomerHomeLayout() {
  const { text } = useCustomerText();
  return <Stack screenOptions={{ headerLeft: ({ canGoBack }) => canGoBack ? null : <RoleDrawerButton label={text('homeNavTitle')} />,
    headerBackVisible: true, headerBackButtonDisplayMode: 'minimal' }} />;
}
