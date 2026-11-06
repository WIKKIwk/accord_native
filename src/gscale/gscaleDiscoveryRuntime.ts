import { Platform } from 'react-native';
import { AccordGscale } from '../../modules/accord-gscale/src/AccordGscaleModule';
import { discoverServers, discoverServersFast, type DiscoveryChannel, type ServerEndpoint } from './gscaleDiscovery';

const discoveryChannel: DiscoveryChannel = {
  discoverServices: options => Platform.OS === 'ios'
    ? AccordGscale.discoverBonjourServices(options)
    : AccordGscale.discoverServices(options),
  discoverAnnouncements: options => AccordGscale.discoverAnnouncements(options),
};

export function scanGscaleServers(preferred: ServerEndpoint | null = null) {
  return discoverServers(fetch, discoveryChannel, preferred);
}

export function scanGscaleServersFast(preferred: ServerEndpoint | null = null) {
  return discoverServersFast(fetch, preferred);
}
