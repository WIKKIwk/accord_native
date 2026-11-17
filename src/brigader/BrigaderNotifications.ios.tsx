import { FlatList, View } from 'react-native';
import { appRoutes } from '../shared/appRoutes';
import { adminText, localizedGetter } from '../shared/localization';
import { BrigaderFeatureFrame } from './BrigaderFeatureFrame';
import { FeatureBusy, FeatureError, FeatureRow } from './BrigaderList';
import { Action, Form, Label } from './BrigaderForm';
import { useBrigaderNotifications } from './useBrigaderNotifications';
import { brigaderNotificationRow } from './brigaderNotificationController';
export function BrigaderNotifications() {
  const { page, state, owner } = useBrigaderNotifications(), a = (key: string) => adminText(key, page.locale);
  return <BrigaderFeatureFrame route={appRoutes.adminNotifications} title={a('notification.title')} drawer>
    {state.loading && !state.requests.length ? <FeatureBusy /> : state.error && !state.requests.length ? <FeatureError message={localizedGetter('serverDisconnectedRetry', page.locale)} retry={owner.load} label={localizedGetter('retry', page.locale)} /> :
      <FlatList data={state.requests} refreshing={false} onRefresh={owner.load} contentContainerStyle={{ padding: 10, paddingBottom: 112, flexGrow: 1 }} keyExtractor={item => String(item.event_id)} ListEmptyComponent={<View style={{ minHeight: 240, alignItems: 'center', justifyContent: 'center' }}><Form><Label>{a('notification.empty')}</Label></Form></View>} renderItem={({ item }) => {
        const row = brigaderNotificationRow(item, state.catalog, page.locale), expanded = state.expanded === row.id, deciding = state.deciding.has(row.id);
        return <View style={{ marginBottom: 8 }}><FeatureRow title={row.title} subtitle={row.subtitle} onPress={() => owner.toggle(item)} />{expanded ? <Form>{row.lines.map((line, index) => <Label key={index}>{line}</Label>)}{row.zero ? <><Label>{a('notification.zero_metrics')}</Label><Label>{row.zero}</Label></> : null}{row.description ? <Label>{row.description}</Label> : null}{row.decision ? <><Label>{a('notification.approval_question')}</Label><Action label={a('notification.reject')} secondary disabled={deciding} onPress={() => { void owner.decide(item, 'reject'); }} /><Action label={a('notification.confirm')} disabled={deciding} onPress={() => { void owner.decide(item, 'approve'); }} /></> : null}</Form> : null}</View>;
      }} />}
  </BrigaderFeatureFrame>;
}
