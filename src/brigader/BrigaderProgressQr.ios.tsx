import { useNativeState } from '@expo/ui/swift-ui';
import { BrigaderProgressQrContent } from './BrigaderProgressQrContent';
export function BrigaderProgressQr(){const buffer=useNativeState('');return <BrigaderProgressQrContent buffer={buffer}/>;}
