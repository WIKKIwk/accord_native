import { Stack } from 'expo-router';
import { RoleDrawerButton } from '../../../../shared/navigation/RoleDrawerButton';
import { useBoyoqchiText } from '../../../../boyoqchi/useBoyoqchiText';
export default function BoyoqchiStack() {
  const t = useBoyoqchiText();
  return <Stack screenOptions={{ headerLeft: () => <RoleDrawerButton label={t('Bo‘yoqchi bo‘limlari')} /> }} />;
}
