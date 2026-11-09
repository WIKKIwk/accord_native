import type { ReactNode } from 'react';
export type AdminActivityPendingProps = { status: 'loading' | 'error'; onRetry: () => void;
  navigation: { icon: 'back'; label: string; onPress: () => void }; footer?: ReactNode };
