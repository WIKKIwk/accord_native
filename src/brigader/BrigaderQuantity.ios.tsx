import { Text } from '@expo/ui/swift-ui';
import { font } from '@expo/ui/swift-ui/modifiers';
import { BaseHost } from '../components/BaseHost.ios';
export function BrigaderQuantity({value}:{value:string}){return <BaseHost matchContents><Text modifiers={[font({size:14,weight:'bold'})]}>{value}</Text></BaseHost>;}
