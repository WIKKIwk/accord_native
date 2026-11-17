import type { ReactNode } from 'react';
export type BrigaderTabsProps = { labels:readonly string[];selected:number;onSelect:(index:number)=>void;children:readonly ReactNode[] };
