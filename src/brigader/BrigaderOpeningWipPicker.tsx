import { useState } from 'react';
import { View,useWindowDimensions } from 'react-native';
import { PickerSheetContent } from '../shared/orders/PickerSheetContent';
import { adminText,localizedGetter } from '../shared/localization';
import { openingOrderLabel,openingOrderMatches } from './openingWipPresentation';
import type { OpeningOrder } from './brigaderOpeningWipModel';
import type { BrigaderPresentation,BrigaderPresentations } from './brigaderPresentations';
export function BrigaderOpeningWipPicker({ entry,owner,interactive,locale }: { entry:BrigaderPresentation;owner:BrigaderPresentations;interactive:()=>boolean;locale:string }) {
  const [query,setQuery] = useState(''),[limit,setLimit] = useState(50),orders = entry.data as OpeningOrder[],rows = orders.filter(order => openingOrderMatches(order,query)),size = useWindowDimensions(),a = (key:string) => adminText(key,locale);
  return <View style={{ height:size.height*.84 }}><PickerSheetContent title={a('raw_material.order_select')} hint={a('raw_material.order_search')} closeLabel={a('action.close')} emptyLabel={localizedGetter('noRecordsYet',locale)} query={query} onSearch={value => { if (interactive()) { setQuery(value);setLimit(50); } }} items={rows.slice(0,limit).map(order => ({ key:order.map.id,title:openingOrderLabel(order,order.map.id),subtitle:order.map.id.trim(),select:() => { if (interactive()) owner.close(entry.id,order); } }))} hasMore={rows.length>limit} onLoadMore={() => { if (interactive()) setLimit(value => value+50); }} onClose={() => { if (interactive()) owner.close(entry.id); }} /></View>;
}
