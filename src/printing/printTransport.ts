/** @v2 PrintTransport */
export type PrintTransport = 'offline' | 'bluetooth' | 'wifi';
export const isLocalPrintTransport = (transport: PrintTransport): boolean => transport === 'offline' || transport === 'bluetooth';
export const printTransportClientApiValue = (transport: PrintTransport): string => isLocalPrintTransport(transport) ? 'offline' : transport;
export const offlineUsbDriverUrl = 'usb://local';
