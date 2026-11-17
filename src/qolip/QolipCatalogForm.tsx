import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { WorkerSheetButton } from '../components/WorkerSheetButton';
import { WorkerIconButton } from '../components/WorkerIconButton';
import { useWorkerColors } from '../components/useWorkerColors';
import { extensionText, localizedGetter, localizedMethod } from '../shared/localization';
import { QolipCatalogField } from './QolipCatalogField';
import { parseQolipBatchCode } from './qolipCode';
import { qolipCatalogColors, qolipPantonNumber, type QolipCatalogFormProps } from './qolipCatalogEditorTypes';
import { useQolipText } from './useQolipText';
import { QolipCatalogPickerRow } from './QolipCatalogPickerRow';

export function QolipCatalogForm({ state: s, actions: a, canSave }: QolipCatalogFormProps) {
  const { locale, text: t } = useQolipText(), c = useWorkerColors();
  const m = (key: string, values: Record<string, unknown> = {}) => extensionText('qolipManagementText', key, locale, values);
  const label = (value: string) => <Text style={{ color: c.text, fontSize: 16 }}>{value}</Text>;
  const multi = s.request.kind === 'spec' || s.request.kind === 'set', draft = multi ? parseQolipBatchCode(s.code) : null;
  const count = draft?.count ?? 0, title = s.request.kind === 'spec' ? t('home.storage_attach') : s.request.kind === 'set' ? m('create')
    : s.request.kind === 'edit' ? t('products.edit_title') : m('add');
  const pantons = [...new Set([...s.pantons, ...s.colors.map(qolipPantonNumber).filter((value): value is number => value !== null)])].sort((a, b) => a - b);
  const colors = [...qolipCatalogColors, ...pantons.map(n => `PANTON ${n}`)];
  return <View style={{ padding: 16, gap: 12 }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}><Text style={{ color: c.text, fontSize: 22, fontWeight: '700', flex: 1 }}>{s.picker === 'product' ? t('home.ready_product_select_title') : s.picker === 'set' ? m('choose') : title}</Text>
      {s.picker && <WorkerIconButton icon="close" label={localizedGetter('closeAction', locale)} onPress={a.closePicker} />}</View>
    {s.picker ? <>
      <QolipCatalogField label={s.picker === 'product' ? t('home.product_customer_search') : m('search')} value={s.pickerQuery} onChange={a.pickerQuery} />
      {s.pickerLoading && <ActivityIndicator />}
      {s.picker === 'product' ? s.products.map((product, index) => <QolipCatalogPickerRow key={`${product.code}:${index}`} title={product.name.trim() || product.code}
        subtitle={[product.customer_names.map((name: string) => name.trim()).filter(Boolean).join(', ') || t('home.customer_unassigned'), product.item_group.trim(), product.has_qolip_spec ? `${product.qolip_code.trim()} • ${product.size}` : ''].filter(Boolean).join(' • ')}
        first={index === 0} last={index === s.products.length - 1} onPress={() => a.pickProduct(product)} />)
        : s.sets.map((entry, index) => <QolipCatalogPickerRow key={entry.set.id} title={entry.display_name} set
          subtitle={[entry.name ? entry.set.id : '', t('products.mold_count', { count: entry.set.members.length })].filter(Boolean).join(' · ')}
          first={index === 0} last={index === s.sets.length - 1} onPress={() => a.reuseSet(entry)} />)}
      {!!s.error && <>{label(localizedGetter('serverDisconnectedRetry', locale))}<WorkerSheetButton label={localizedGetter('retry', locale)} onPress={a.retryPicker} /></>}
      {!s.pickerLoading && !s.error && !(s.picker === 'product' ? s.products.length : s.sets.length) && label(localizedGetter('noRecordsYet', locale))}
    </> : <>
      {!!s.request.scope && label(s.request.scope)}
      {s.request.kind === 'set' ? label(m('create_hint')) : s.request.kind === 'spec' ? <WorkerSheetButton label={s.product ? [s.product.name.trim() || s.product.code.trim(), s.product.has_qolip_spec ? `${s.product.qolip_code.trim()} • ${s.product.size}` : ''].filter(Boolean).join(' • ') : t('home.product_search_hint')}
        disabled={s.saving || !!s.saved.length || s.request.lockProduct} onPress={a.chooseProduct} /> : null}
      {multi && <>{s.warehouseLoading ? <ActivityIndicator /> : s.warehouseFailed || !s.warehouses.length ? <WorkerSheetButton label={t('blocks.load_failed')} onPress={a.loadWarehouses} />
        : <View style={{ gap: 8 }}>{label(extensionText('qolipSharedSetText', 'warehouse', locale))}
          {s.warehouses.map(warehouse => <WorkerSheetButton key={warehouse} label={warehouse} variant={s.warehouse === warehouse ? 'filled' : 'outlined'}
            disabled={s.saving || !!s.saved.length} onPress={() => a.setWarehouse(warehouse)} />)}</View>}</>}
      {s.request.allowExisting && <><View style={{ flexDirection: 'row', gap: 8 }}><View style={{ flex: 1 }}><WorkerSheetButton label={m('new_code')} variant={!s.existing ? 'filled' : 'outlined'} onPress={() => a.setExisting(false)} disabled={s.saving} /></View>
        <View style={{ flex: 1 }}><WorkerSheetButton label={m('existing_code')} variant={s.existing ? 'filled' : 'outlined'} onPress={() => a.setExisting(true)} disabled={s.saving} /></View></View>{s.existing && label(m('existing_hint'))}</>}
      <QolipCatalogField label={multi ? t('home.mold_code_label') : t('products.code')} value={s.code} onChange={a.setCode} disabled={s.saving || !!s.saved.length} />
      {s.suggestionsLoading ? <ActivityIndicator /> : s.suggestionsFailed ? <WorkerSheetButton label={m('lookup_retry')} onPress={a.retrySuggestions} /> : s.suggestions.slice(0, 3).map((entry, index) => <QolipCatalogPickerRow key={entry.set.id} title={entry.display_name} set
        subtitle={[entry.name ? entry.set.id : '', t('products.mold_count', { count: entry.set.members.length })].filter(Boolean).join(' · ')}
        first={index === 0} last={index === Math.min(3, s.suggestions.length) - 1} onPress={() => a.reuseSet(entry)} disabled={s.saving} />)}
      {s.suggestions.length > 3 && <WorkerSheetButton label={m('all_matches', { count: s.suggestions.length })} onPress={a.allSuggestions} />}
      {s.request.kind === 'spec' && <WorkerSheetButton label={m('choose')} disabled={s.saving || !s.product || !!s.saved.length} onPress={a.chooseSet} />}
      {!!draft && <><WorkerSheetButton label={t('products.mold_count', { count })} onPress={a.toggleCodes} />{s.expandedCodes && draft.codes.map(code => <Text key={code} style={{ color: c.text }}>{code}</Text>)}</>}
      {!s.existing && <><QolipCatalogField label={multi ? t('home.size_label') : t('products.size')} numeric value={s.size} onChange={a.setSize} disabled={s.saving || !!s.saved.length} />
        {label(multi ? t('home.color_label', { selected: s.colors.length, total: s.saved.length || count }) : t('products.color'))}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{colors.map(color => {
          const index = s.colors.indexOf(color), panton = qolipPantonNumber(color), name = panton ? `Panton ${panton}` : localizedMethod('qolipColorName', locale, { raw: color });
          return <Pressable key={color} accessibilityRole="button" accessibilityLabel={name} accessibilityState={{ selected: index >= 0 }}
            disabled={s.saving || !!s.saved.length || (multi && !draft)} onPress={() => a.chooseColor(color)} style={{ width: 60, alignItems: 'center', gap: 3 }}>
            <View style={{ width: 44, height: 44, backgroundColor: panton ? c.icon : color,
              ...(panton ? { backgroundImage: 'linear-gradient(135deg, #E53935, #FDD835, #43A047, #3949AB, #D81B60)' } : {}), borderColor: index >= 0 ? c.text : c.muted, borderWidth: index >= 0 ? 3 : 1, borderRadius: 22,
              justifyContent: 'center', alignItems: 'center' }}>{index >= 0 && <Text style={{ color: color === '#FFFFFF' || color === '#FDD835' ? '#111' : '#fff', fontSize: 20, fontWeight: '800' }}>{multi ? index + 1 : '✓'}</Text>}</View>
            <Text numberOfLines={1} style={{ color: c.text, fontSize: 11 }}>{name}</Text>
          </Pressable>;
        })}{multi && s.pantons.length < count && <View style={{ width: 92 }}><WorkerSheetButton label="+ Panton" onPress={a.addPanton} disabled={s.saving || !!s.saved.length} height={64} /></View>}</View>
      </>}
      {!!s.error && <Text accessibilityLiveRegion="polite" style={{ color: c.error }}>{s.error}</Text>}
      {s.saving && <ActivityIndicator />}
      {s.saved.length ? <WorkerSheetButton label={t('action.print_qr')} onPress={a.printSaved} disabled={s.saving} variant="filled" height={54} />
        : <WorkerSheetButton label={t('action.save')} onPress={a.save} disabled={!canSave} variant="filled" height={54} />}
      {(s.request.kind === 'mold' || s.request.kind === 'edit') && <WorkerSheetButton label={t('action.cancel')} onPress={a.close} disabled={s.saving} height={54} />}
    </>}
  </View>;
}
