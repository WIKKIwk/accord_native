import { MetalayzerIosShell } from '../../metalayzer/MetalayzerIosShell';
import { MetalayzerSessionGate } from '../../metalayzer/MetalayzerSessionGate';

export default function Layout() {
  return <MetalayzerSessionGate platform="ios"><MetalayzerIosShell /></MetalayzerSessionGate>;
}
