import type { Session } from '../auth';
import type { AdminApparatus } from '../apparatusApi';
import { WorkerSheetButton } from '../components/WorkerSheetButton';
import { useWorkerColors } from '../components/useWorkerColors';
import { StyleSheet, Text, View } from 'react-native';
import { BoyoqchiImage } from './BoyoqchiImage';
import { boyoqchiAmount, boyoqchiApparatusLabel, boyoqchiCategoryLabel, boyoqchiDate, boyoqchiGroups,
  boyoqchiItemText, boyoqchiOperator, boyoqchiOrderLabel } from './boyoqchiLogic';
import type { ReturnedPaintRequest } from './returnedPaintModel';
import { useBoyoqchiText } from './useBoyoqchiText';

function Row({ label, value, prominent = false, compact = false }: { label: string; value: string; prominent?: boolean; compact?: boolean }) {
  const colors = useWorkerColors(), t = useBoyoqchiText();
  return <View style={[styles.row, compact && styles.compactRow]}><Text style={[compact ? styles.compactRowLabel : styles.rowLabel, { color: colors.text }]}>{t(label)}</Text>
    <Text style={[styles.rowValue, { color: colors.text, textAlign: compact ? 'left' : 'right',
      fontWeight: prominent ? compact ? '700' : '800' : '500' }]}>{value}</Text></View>;
}
export function BoyoqchiRequestContent({ session, request, home, apparatus, onEdit }: {
  session: Session; request: ReturnedPaintRequest; home: boolean; apparatus: readonly AdminApparatus[]; onEdit: () => void;
}) {
  const colors = useWorkerColors(), t = useBoyoqchiText();
  if (home) return <View style={styles.content}>
    <Row label="Order" value={boyoqchiOrderLabel(request)} prominent compact />
    <Row label="Operator" value={request.sender_display_name.trim() || '—'} compact />
    <Row label="Time" value={boyoqchiDate(request.created_at)} compact />
    <Row label="Location" value={boyoqchiApparatusLabel(request.apparatus, apparatus)} compact />
    {['rasxot', 'astatka'].map(usage => {
      const groups = boyoqchiGroups(request.items, usage);
      return groups.length ? <View key={usage} style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>{usage === 'rasxot' ? 'Rasxot' : 'Astatka'}</Text>
        {groups.map(group => <View key={group.category} style={styles.group}>
          <Text style={[styles.groupTitle, { color: colors.text }]}>{t(boyoqchiCategoryLabel(group.category))}</Text>
          {group.items.map((item, index) => {
            const name = item.name.trim() || '—', text = boyoqchiItemText(item);
            return <Text key={index} style={{ color: colors.text, fontWeight: '500' }}><Text style={{ fontWeight: '700' }}>{name}</Text>{text.slice(name.length)}</Text>;
          })}
        </View>)}
      </View> : null;
    })}
  </View>;
  const calculation = request.calculation;
  return <View style={styles.content}>
    <Row label="Order kodi" value={request.order_code.trim() || request.order_id.trim() || '—'} prominent />
    <Row label="Operator" value={boyoqchiOperator(request)} />
    <Row label="Sana va vaqt" value={boyoqchiDate(request.created_at)} />
    {request.image && <BoyoqchiImage session={session} image={request.image} allowDownload />}
    <View style={[styles.divider, { backgroundColor: colors.field }]} />
    {request.status === 'waiting_for_boyoqchi_input' ? <>
      <View style={[styles.waiting, { backgroundColor: colors.field }]}><Text style={{ color: colors.text, fontWeight: '600' }}>
        {t('Qaytarilgan bo‘yoq qiymatlari kiritilmagan. Rasmdagi qiymatlarni Bo‘yoqchi to‘ldirishi kerak.')}
      </Text></View>
      <WorkerSheetButton label={t('Qaytarilgan bo‘yoq')} onPress={onEdit} variant="filled"
        icon={{ ios: 'paintpalette', android: 'palette' }} />
    </> : calculation ? <>
      <Row label="Rasxot jami Mix" value={boyoqchiAmount(calculation.rasxot_mix_total)} />
      <Row label="Astatka jami Mix" value={boyoqchiAmount(calculation.astatka_mix_total)} />
      <Row label="Rasxot spirt miqdori" value={boyoqchiAmount(calculation.rasxot_alcohol)} />
      <Row label="Astatka spirt miqdori" value={boyoqchiAmount(calculation.astatka_alcohol)} />
      <Row label="Yakuniy ishlatilgan spirt" value={boyoqchiAmount(calculation.final_used_alcohol)} prominent />
      <View style={[styles.divider, { backgroundColor: colors.field }]} />
      <Row label="Rasxot sof bo‘yoq miqdori" value={boyoqchiAmount(calculation.rasxot_pure_paint)} />
      <Row label="Astatka sof bo‘yoq miqdori" value={boyoqchiAmount(calculation.astatka_pure_paint)} />
      <Row label="Yakuniy ishlatilgan bo‘yoq" value={boyoqchiAmount(calculation.final_used_paint)} prominent />
    </> : <Text style={{ color: colors.muted, fontWeight: '600' }}>{t('Ushbu eski hisobot uchun hisoblash ma’lumoti mavjud emas.')}</Text>}
  </View>;
}
const styles = StyleSheet.create({
  content: { paddingHorizontal: 16, paddingBottom: 16, gap: 8 }, row: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' }, compactRow: { gap: 0 },
  rowLabel: { flex: 1, fontWeight: '700' }, compactRowLabel: { width: 74, fontWeight: '800' }, rowValue: { flex: 1 },
  section: { gap: 8, marginTop: 10 }, sectionTitle: { fontSize: 16, fontWeight: '800' }, group: { gap: 5, paddingVertical: 7 },
  groupTitle: { fontWeight: '800' }, divider: { height: StyleSheet.hairlineWidth, marginVertical: 8 }, waiting: { borderRadius: 12, padding: 12 },
});
