import { ScrollView,Platform } from 'react-native';
import { router,type Href } from 'expo-router';
import { appRoutes } from '../shared/appRoutes';
import { adminText,localizedGetter } from '../shared/localization';
import { useBrigaderFeature } from './BrigaderFeatureContext';
import { BrigaderFeatureFrame } from './BrigaderFeatureFrame';
import { BrigaderBottomBar } from './BrigaderBottomBar';
import { BrigaderCreateHubRows } from './BrigaderCreateHubRows';
export function BrigaderCreateHubContent(){const page=useBrigaderFeature(appRoutes.adminCreateHub),t=(key:string)=>localizedGetter(key,page.locale),a=(key:string)=>adminText(key,page.locale),entries=[
{title:t('adminCreateUserTitle'),subtitle:t('adminCreateUserSubtitle'),route:appRoutes.adminUserCreate},
{title:a('create_hub.worker_settings'),subtitle:a('create_hub.worker_settings_subtitle'),route:appRoutes.adminWorkerSettings},
{title:t('adminErpSettingsTitle'),subtitle:t('adminErpSettingsSubtitle'),route:appRoutes.adminSettings},
{title:t('adminCreateItemTitle'),subtitle:t('adminCreateItemSubtitle'),route:appRoutes.adminItemCreate},
{title:t('adminCreateItemGroupTitle'),subtitle:t('adminCreateItemGroupSubtitle'),route:appRoutes.adminItemGroupCreate},
{title:t('adminCreateOrderTitle'),subtitle:a('create_hub.saved_order'),route:appRoutes.adminCalculate},
];return <BrigaderFeatureFrame route={appRoutes.adminCreateHub} title={t('adminCreateTitle')} footer={<BrigaderBottomBar active="settings"/>}><ScrollView contentContainerStyle={{paddingTop:4,paddingBottom:136}}><BrigaderCreateHubRows rows={entries.map(row=>({...row,open:()=>{const path=page.interactive()?page.shell.destination(row.route,Platform.OS):null;if(path)router.push(path as Href);}}))}/></ScrollView></BrigaderFeatureFrame>;}
