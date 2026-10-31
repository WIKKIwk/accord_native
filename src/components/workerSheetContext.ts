import { createContext } from 'react';

export const WorkerSheetCloseContext = createContext<(() => void) | null>(null);
