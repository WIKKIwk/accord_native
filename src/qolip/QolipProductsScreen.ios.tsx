import { Button, Circle, Host, HStack, Image, List, ProgressView, RNHostView, Section, Text, VStack } from '@expo/ui/swift-ui';
import { buttonStyle, disabled, font, foregroundStyle, frame, labelStyle, lineLimit, listStyle, onAppear, onLongPressGesture, padding, refreshable } from '@expo/ui/swift-ui/modifiers';
import { Pressable, View } from 'react-native';
import { WorkerOrderImage } from '../components/WorkerOrderHeader';
import { WorkerOrderThumbnail } from '../components/WorkerOrderThumbnail';
import { WorkerOrderSheet } from '../components/WorkerOrderSheet';
import { useWorkerColors } from '../components/useWorkerColors';
import { extensionText } from '../shared/localization';
import { QolipCatalogActionMenu } from './QolipCatalogActionMenu';
import { QolipCatalogCodeDetails } from './QolipCatalogCodeDetails';
import { qolipContainerKey } from './qolipProductContainer';
import { qolipProductPassivePresentation } from './qolipProductPassivePresentation';
import { qolipProductMoldKey } from './qolipProductsState';
import { useQolipProductsScreen } from './useQolipProductsScreen';
import { OrdersHeader } from '../shared/orders/OrdersHeader';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/** @v2 QolipProductsScreen */
export function QolipProductsScreen() {
  const h = useQolipProductsScreen(), { state: s, controller, t, role } = h, colors = useWorkerColors(), insets = useSafeAreaInsets();
  if (s.invalid || !role.isCurrent()) return null;
  return <View style={{ flex: 1, paddingTop: insets.top }}>
    {s.selectionMode ? <Host matchContents><HStack spacing={12} modifiers={[padding({ horizontal: 12, vertical: 8 })]}>
      <Button label={t('products.selection_cancel')} systemImage="xmark" onPress={h.cancel} modifiers={[labelStyle('iconOnly'), frame({ minWidth: 44, minHeight: 44 }), disabled(h.busy)]} />
      <Text>{t('products.selected_only', { selected: s.selectedCodes.size })}</Text>
      <Button label={t('products.selection_print')} systemImage="printer" onPress={() => { void h.printSelected(); }} modifiers={[labelStyle('iconOnly'), frame({ minWidth: 44, minHeight: 44 }), disabled(h.busy)]} />
      <Button label={t('products.selection_delete')} systemImage="trash" onPress={() => { void h.remove(); }} modifiers={[labelStyle('iconOnly'), frame({ minWidth: 44, minHeight: 44 }), disabled(h.busy)]} />
    </HStack></Host> : <OrdersHeader search={s.query} searchPlaceholder={t('products.search')} onSearchChange={value => controller.setSearch(value)} onMenu={role.onMenu} onProfile={role.onProfile} />}
    <Host style={{ flex: 1 }}><List key={s.listRevision} modifiers={[listStyle('plain'), refreshable(() => controller.reload())]}>
      {s.loading ? <Section><ProgressView /></Section> : s.error ? <Section><Button label={t('action.retry')} onPress={() => { void controller.reload(); }} /></Section>
        : s.containers.length === 0 ? <Section><Text>{t(s.query.trim() ? 'products.search_empty' : 'products.empty')}</Text></Section> : s.containers.map(row => {
          const key = qolipContainerKey(row), view = qolipProductPassivePresentation(row, s.reworkCodes), expanded = s.expanded === key;
          return <Section key={key}><VStack alignment="leading" spacing={10}>
            <HStack spacing={10}>
              <RNHostView matchContents><Pressable onLongPress={() => h.setImageId(view.coverId)}><WorkerOrderThumbnail session={role.session} orderId={view.coverId} imageId="" active={role.isCurrent()} size={64} backgroundColor={colors.field} iconColor={colors.icon} /></Pressable></RNHostView>
              <Button onPress={() => h.toggleExpanded(row)} modifiers={[disabled(h.busy), frame({ maxWidth: Infinity, alignment: 'leading' }), onLongPressGesture(() => h.toggleContainer(row))]}>
                <VStack alignment="leading" spacing={4}><Text modifiers={[font({ weight: 'bold' }), lineLimit(2)]}>{view.title}</Text>
                  {view.hasDetails && <Text>{t(view.inUse ? 'products.count_in_use' : 'products.mold_count', { count: view.count })}</Text>}
                  {view.reworkCount > 0 && <Text modifiers={[foregroundStyle(colors.error)]}>{h.rw('in_rework_count', { count: view.reworkCount })}</Text>}
                </VStack>
              </Button>
              {s.selectionMode === 'containers' && <Button label={view.title} systemImage={s.selectedContainers.has(key) ? 'checkmark.circle.fill' : 'circle'} onPress={() => h.toggleContainer(row)} modifiers={[labelStyle('iconOnly'), disabled(h.busy || view.inUse || view.reworkCount > 0)]} />}
              {s.selectedContainers.has(key) && <Button label={extensionText('qolipProductPdfText', 'share', h.locale)} systemImage="square.and.arrow.up" onPress={() => { void h.share(row); }} modifiers={[labelStyle('iconOnly'), disabled(!!h.sharing)]} />}
              {s.detailPending.has(key) ? <ProgressView /> : <Image systemName={expanded ? 'chevron.up' : 'chevron.down'} />}
            </HStack>
            {expanded && view.hasDetails && !s.selectionMode && <Button label={t('products.add')} systemImage="plus" onPress={() => { void h.addChoices(row); }} modifiers={[buttonStyle('bordered')]} />}
            {expanded && (s.detailErrors.has(key) ? <Button label={t('action.retry')} onPress={() => { void controller.ensureDetails(row); }} /> : view.sections.map(section => <VStack key={section.id} alignment="leading" spacing={8}>
              {section.extension ? <Text>{extensionText('qolipSharedSetText', 'extensions', h.locale)}</Text> : <Button label={`${extensionText('qolipSharedSetText', 'id', h.locale)}: ${section.id}`} systemImage="doc.on.doc" onPress={() => { void h.copy(section.id, true); }} />}
              {section.alternativeIndex !== null && <Text>{`${t('products.alternative_set')} ${section.alternativeIndex}`}</Text>}
              {section.members.map(({ product, inRework, color, subtitle }, index) => <HStack key={`${product.qolip_code}:${index}`} spacing={8}>
                <Image systemName={inRework ? 'wrench' : product.is_in_use ? 'lock' : 'qrcode'} />
                {color && <Circle modifiers={[frame({ width: 16, height: 16 }), foregroundStyle(color)]} />}
                <Button onPress={() => s.selectionMode === 'qolips' ? h.toggleMold(product) : h.setQrProduct(product)} modifiers={[frame({ maxWidth: Infinity, alignment: 'leading' }), onLongPressGesture(() => h.toggleMold(product))]}>
                  <VStack alignment="leading" spacing={3}><Text modifiers={[font({ weight: 'bold' })]}>{product.qolip_code}</Text>
                    <Text>{subtitle === 'rework' ? h.rw('open') : subtitle === 'issued' ? t('products.issued') : subtitle === 'size' ? t('products.size_value', { size: product.size }) : ''}</Text></VStack>
                </Button>
                <Button label={product.qolip_code} systemImage="doc.on.doc" onPress={() => { void h.copy(product.qolip_code); }} modifiers={[labelStyle('iconOnly')]} />
                {s.selectionMode === 'qolips' ? <Button label={product.qolip_code} systemImage={s.selectedCodes.has(qolipProductMoldKey(product)) ? 'checkmark.circle.fill' : 'circle'} onPress={() => h.toggleMold(product)} modifiers={[labelStyle('iconOnly'), disabled(h.busy || product.is_in_use || inRework)]} />
                  : !product.is_in_use && !inRework ? <Button label={t('products.edit_title')} systemImage="pencil" onPress={() => { void h.edit(product); }} modifiers={[labelStyle('iconOnly')]} /> : null}
              </HStack>)}
            </VStack>))}
          </VStack></Section>;
        })}
      {s.nextCursor && <Section key={`page-${s.nextCursor}`}>{s.pageError ? <Button label={t('action.retry')} onPress={() => { void controller.more(); }} /> : <ProgressView modifiers={[onAppear(() => { void controller.more(); })]} />}</Section>}
    </List></Host>
    {h.addProduct && <QolipCatalogActionMenu close={() => h.setAddProduct(null)} actions={[
      { id: 'add', label: h.m('add'), onPress: () => { const product = h.addProduct!; h.setAddProduct(null); void h.addMold(product); } },
      { id: 'choose', label: h.m('choose'), onPress: () => { void h.chooseSet(h.addProduct!); } },
      { id: 'new', label: h.m('new_set'), onPress: () => { const product = h.addProduct!; h.setAddProduct(null); void h.spec(product); } },
    ]} />}
    {h.qrProduct && <WorkerOrderSheet onClose={() => h.setQrProduct(null)} dismissible compact><QolipCatalogCodeDetails product={h.qrProduct} copy={code => { void h.copy(code); }} close={() => h.setQrProduct(null)} cancelAsError /></WorkerOrderSheet>}
    {h.imageId && <WorkerOrderSheet onClose={() => h.setImageId(null)} dismissible><WorkerOrderImage session={role.session} orderId={h.imageId} imageId="" onClose={() => h.setImageId(null)} /></WorkerOrderSheet>}
    {h.editor.content}
  </View>;
}
