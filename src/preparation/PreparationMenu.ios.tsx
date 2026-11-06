import { Button, Host, Menu } from '@expo/ui/swift-ui';
import { disabled } from '@expo/ui/swift-ui/modifiers';
import { router, type Href } from 'expo-router';
import { usePreparationContext } from './PreparationContext';
import { usePreparationText } from './PreparationUI';
import { appRoutes, canOpenRoute } from '../shared/appRoutes';
import { openPreparationScale } from './PreparationRoutes';

export function PreparationMenu() {
  const { session, home } = usePreparationContext(), t = usePreparationText();
  const root = (route: string) => router.dismissTo(route as Href);
  return <Host matchContents><Menu label={t('Bo‘limlar')} systemImage="line.3.horizontal">
    <Button label={t('Tayyorlov')} onPress={() => root('/ios-preparation')} />
    <Button label={t('Formulalar')} onPress={() => root('/ios-preparation/catalog')} />
    <Button label={t('Ishlab chiqarish')} onPress={() => root('/ios-preparation/production')} />
    <Button label={t('Ketma-ketlik')} onPress={() => router.push('/ios-preparation/sequence' as Href)} />
    {canOpenRoute(session, appRoutes.gscaleMode) && <Button label={t('Kirim')} onPress={() => openPreparationScale({ warehouse: home.warehouse })} />}
    <Button label={t('Chat')} modifiers={[disabled(true)]} />
    {canOpenRoute(session, appRoutes.inventoryMovements) && <Button label={t('Ishlab chiqarilgan homashyolar')} onPress={() => router.push('/ios-preparation/inventory' as Href)} />}
    <Button label={t('Profil')} onPress={() => router.navigate('/ios-preparation/profile' as Href)} />
  </Menu></Host>;
}
