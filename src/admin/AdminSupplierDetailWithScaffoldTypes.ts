import type { ReactElement } from 'react';
import type { AdminSupplierDetailScreenProps } from './AdminSupplierDetailScreenTypes';

type WithScaffold<T> = T extends unknown ? Omit<T, 'bodySafeAreaBottom' | 'canInteractBody' | 'footer'> & { footer: ReactElement } : never;
/** Requires the real root CreateHub layout provider and the genuine source dock. */
export type AdminSupplierDetailWithScaffoldProps = WithScaffold<AdminSupplierDetailScreenProps>;
