import { HStack } from '@expo/ui/swift-ui';
import type { ReactNode } from 'react';
export function WorkerCutToolbar({ children }: { children: ReactNode }) { return <HStack spacing={8}>{children}</HStack>; }
