import type { ReactNode } from 'react';
export type BrigaderTabsProps = { labels:readonly string[];height?:number;selected:number;onSelect:(index:number)=>void;children:readonly ReactNode[] };
