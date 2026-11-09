import { WerkaReceiveFooter } from './WerkaReceiveFooter.ios';
import { werkaPaddonFooterProps, type WerkaPaddonFooterInput } from './werkaPaddonPresentation';

/** Footer only; the source shared pallet-detail screen is not implemented or routed here. */
export function WerkaPaddonFooter(props: WerkaPaddonFooterInput) {
  return <WerkaReceiveFooter {...werkaPaddonFooterProps(props)} />;
}
