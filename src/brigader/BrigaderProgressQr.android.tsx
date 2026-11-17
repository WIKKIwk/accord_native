import { useNativeState } from '@expo/ui/jetpack-compose';
import { BrigaderProgressQrContent } from './BrigaderProgressQrContent';
export function BrigaderProgressQr(){const buffer=useNativeState('');return <BrigaderProgressQrContent buffer={buffer}/>;}
