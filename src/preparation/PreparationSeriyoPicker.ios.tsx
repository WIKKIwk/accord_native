import { Button, Host, List, Text, TextField, VStack } from '@expo/ui/swift-ui';
import { onAppear } from '@expo/ui/swift-ui/modifiers';
import type { PreparationMaterial } from './preparationLogic';
import { usePreparationSeriyoPicker } from './usePreparationSeriyoPicker';
import { usePreparationText } from './PreparationUI';

export function PreparationSeriyoPicker({ materials, choose, title = 'Seriyo tanlang', subtitle, searchText }: {
  materials: PreparationMaterial[]; choose: (material: PreparationMaterial) => void; title?: string;
  subtitle?: (material: PreparationMaterial) => string; searchText?: (material: PreparationMaterial) => string;
}) {
  const t = usePreparationText(), picker = usePreparationSeriyoPicker(materials, searchText);
  return <Host style={{ flex: 1 }}><VStack><Text>{t(title)}</Text>
    <TextField placeholder={t('Qidirish')} onTextChange={picker.setQuery} />
    <List>{picker.items.length === 0 && <Text>{t('Bu ro‘yxatda hozircha yozuv yo‘q.')}</Text>}
      {picker.items.map((item, index) => <Button key={item.code}
        modifiers={index === picker.items.length - 1 && picker.hasMore ? [onAppear(picker.loadMore)] : []}
        onPress={() => choose(item)}><VStack alignment="leading"><Text>{item.name}</Text>{subtitle && <Text>{subtitle(item)}</Text>}</VStack></Button>)}
    </List>
  </VStack></Host>;
}
