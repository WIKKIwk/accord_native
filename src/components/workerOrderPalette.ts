import type { MaterialColors } from '@expo/ui/jetpack-compose';
import { createContext } from 'react';

export const WorkerOrderPalette = createContext<MaterialColors | null>(null);
