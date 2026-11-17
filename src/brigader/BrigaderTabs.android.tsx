import { Column,HorizontalPager,RNHostView,Row,TextButton,type HorizontalPagerHandle } from '@expo/ui/jetpack-compose';
import { background,fillMaxSize,fillMaxWidth,height,weight } from '@expo/ui/jetpack-compose/modifiers';
import { useEffect,useRef } from 'react';
import { View } from 'react-native';
import { BaseHost } from '../components/BaseHost.android';
import { useBaseTheme } from '../components/useBaseTheme';
import { AdminText as Text } from '../admin/AdminTypography.android';
import type { BrigaderTabsProps } from './brigaderTabsTypes';
export function BrigaderTabs(props:BrigaderTabsProps) {
  const pager = useRef<HorizontalPagerHandle>(null),{ colors } = useBaseTheme();
  useEffect(() => { void pager.current?.animateScrollToPage(props.selected); },[props.selected]);
  return <BaseHost style={{ flex:1 }}><Column modifiers={[fillMaxSize()]}><Row modifiers={[fillMaxWidth(),height(props.height??38),background(colors.surfaceContainer)]}>{props.labels.map((label,index) => <TextButton key={index} onClick={() => props.onSelect(index)} modifiers={[weight(1),height(props.height??38)]}><Text color={props.selected === index ? colors.primary : colors.onSurfaceVariant}>{label}</Text></TextButton>)}</Row>
    <HorizontalPager ref={pager} initialPage={props.selected} onCurrentPageChange={props.onSelect} modifiers={[fillMaxWidth(),weight(1)]}>{props.children.map((child,index) => <RNHostView key={index} modifiers={[fillMaxSize()]}><View style={{ flex:1 }}>{child}</View></RNHostView>)}</HorizontalPager>
  </Column></BaseHost>;
}
