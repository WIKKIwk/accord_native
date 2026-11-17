import { useMemo } from 'react';
import { QolipPageHeaderProvider } from './QolipPageHeaderContext';
import { Redirect, router, useLocalSearchParams, type Href } from 'expo-router';
import { Platform } from 'react-native';
import { ProfileScreen } from '../components/ProfileScreen';
import { extensionText, localizedGetter } from '../shared/localization';
import { QolipPage } from './QolipPage';
import { QolipHomeScreen } from './QolipHomeScreen';
import { QolipBlocksScreen } from './QolipBlocksScreen';
import { QolipProductsScreen } from './QolipProductsScreen';
import { QolipSetsScreen } from './QolipSetsScreen';
import { QolipReworksScreen } from './QolipReworksScreen';
import { QolipCheckoutsScreen } from './QolipCheckoutsScreen';
import { QolipLocationTransferScreen } from './QolipLocationTransferScreen';
import { QolipProductTransferScreen } from './QolipProductTransferScreen';
import { QolipStorageScreen } from './QolipStorageScreen';
import { QolipPaddonScreen } from './QolipPaddonScreen';
import { QolipArchiveDetailScreen } from './QolipArchiveDetailScreen';
import { QolipTasksScreen } from './QolipTasksScreen';
import { QolipSequenceScreen } from './QolipSequenceScreen';
import { qolipArchiveEntryFromJson } from './qolipStorageApi';
import { useQolipRole } from './QolipRoleContext';
import { useQolipText } from './useQolipText';
export function QolipRoutePage({ screen }: { screen: string }) {
  const role = useQolipRole(), { text, locale } = useQolipText(), params = useLocalSearchParams<{ code?: string; addMolds?: string; entry?: string }>();
  const archiveEntry = useMemo(() => params.entry ? qolipArchiveEntryFromJson(JSON.parse(params.entry)) : null, [params.entry]);
  const shared = { session: role.session, onMenu: role.onMenu, onProfile: role.onProfile, dock: role.dock, isCurrent: role.isCurrent };
  let title = '', ownHeader = false, content;
  switch (screen) {
    case 'home': title = localizedGetter('homeNavTitle', locale); ownHeader = true; content = <QolipHomeScreen />; break;
    case 'blocks': title = text('nav.blocks'); ownHeader = true; content = <QolipBlocksScreen {...shared} />; break;
    case 'products': title = text('nav.molds'); ownHeader = true; content = <QolipProductsScreen />; break;
    case 'sets': title = extensionText('qolipManagementText', 'title', locale); ownHeader = true; content = <QolipSetsScreen />; break;
    case 'reworks': title = extensionText('qolipReworkText', 'title', locale); ownHeader = true; content = <QolipReworksScreen {...shared} />; break;
    case 'checkouts': title = text('checkouts.title'); ownHeader = true; content = <QolipCheckoutsScreen />; break;
    case 'transfer': title = text('transfer.title'); content = <QolipLocationTransferScreen />; break;
    case 'product-transfer': title = text('product_transfer.title'); content = <QolipProductTransferScreen />; break;
    case 'paddons': case 'archive': title = extensionText('qolipStorageText', screen, locale); ownHeader = Platform.OS === 'android'; content = <QolipStorageScreen mode={screen} />; break;
    case 'paddon': title = params.code ?? ''; content = <QolipPaddonScreen code={params.code ?? ''} addMolds={params.addMolds === 'true'} />; break;
    case 'archive-detail': { if (!archiveEntry) return <Redirect href={('/' + Platform.OS + '-qolip/archive') as Href} />;
      title = archiveEntry.code; content = <QolipArchiveDetailScreen entry={archiveEntry} />; break; }
    case 'profile': title = localizedGetter('profileTitle', locale); content = <ProfileScreen session={role.session} onLogout={role.onLogout} isCurrent={role.isCurrent} />; break;
    case 'tasks': title = text('nav.tasks'); ownHeader = true; content = <QolipTasksScreen />; break;
    case 'sequence': title = text('nav.sequence'); ownHeader = true; content = <QolipSequenceScreen />; break;
    default: throw new Error('Unknown Qolip route');
  }
  return <QolipPageHeaderProvider><QolipPage title={title} ownHeader={ownHeader} back={['paddon', 'archive-detail', 'product-transfer', 'archive'].includes(screen)} onBack={screen === 'archive' ? () => router.dismissTo(('/' + Platform.OS + '-qolip') as Href) : undefined}>{content}</QolipPage></QolipPageHeaderProvider>;
}
