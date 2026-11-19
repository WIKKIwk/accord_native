import { AdminHomeShortcutRoute } from '../../admin/AdminHomeShortcutRoute';
import { AdminLoadingIndicator } from '../../admin/AdminLoadingIndicator.android';
import { BaseHost } from '../../components/BaseHost.android';
import { BrigaderFactoryMapContent } from '../../brigader/BrigaderFactoryMapContent';
import { appRoutes } from '../../shared/appRoutes';
import { View } from 'react-native';

/** @v2 AdminFactoryMapScreen */
export default function FactoryMapRoute() {
  return <AdminHomeShortcutRoute route={appRoutes.adminFactoryMap} drawer>
    <BrigaderFactoryMapContent embedded loading={
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}><BaseHost matchContents><AdminLoadingIndicator /></BaseHost></View>
    } />
  </AdminHomeShortcutRoute>;
}
