import { Stack } from 'expo-router';
import { RoleDrawerButton } from '../../../../shared/navigation/RoleDrawerButton';
import { useBoyoqchiGetter, useBoyoqchiText } from '../../../../boyoqchi/useBoyoqchiText';

export default function BoyoqchiProfileStack() {
  const getter = useBoyoqchiGetter(), t = useBoyoqchiText();
  return <Stack screenOptions={{ title: getter('profileTitle'),
    headerLeft: () => <RoleDrawerButton label={t('Bo‘yoqchi bo‘limlari')} /> }} />;
}
