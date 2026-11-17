import type { ReactNode } from 'react';
export type BrigaderExpandableCardProps={title:string;subtitle?:string;expanded:boolean;index:number;count:number;onToggle:()=>void;children:ReactNode;icon?:'worker'|'group'};
