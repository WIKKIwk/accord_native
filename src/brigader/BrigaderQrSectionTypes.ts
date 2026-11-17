import type { ReactNode } from 'react';
import type { PassportLine } from '../admin/adminProgressQrPassport';
export type BrigaderQrSectionProps={title?:string;subtitle?:string;lines?:readonly PassportLine[];paragraphs?:readonly string[];badges?:readonly string[];index?:number;folded?:boolean;onToggle?:()=>void;children?:ReactNode;compact?:boolean};
