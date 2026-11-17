import type { ProductionMapDraftNode as Node } from '../admin/productionMapDraftModel';
export const productionBranchLabel = (value: string) => value.trim().toLowerCase() === 'true' ? 'Shunda' : value.trim().toLowerCase() === 'false' ? 'Aks holda' : value;
export function productionNodeCorners(node: Node, nodes: readonly Node[]) { const group = node.alternative_group_id.trim(); if (!group)
    return [28, 28] as const; const members = nodes.filter(item => item.alternative_group_id.trim() === group).sort((a, b) => a.x - b.x), index = members.findIndex(item => item.id === node.id); return members.length <= 1 ? [28, 28] as const : index <= 0 ? [28, 2] as const : index === members.length - 1 ? [2, 28] as const : [2, 2] as const; }
export type ProductionNodeBodyProps = {
    title: string;
    subtitle: string;
    kind: string;
    locked: boolean;
    selected: boolean;
    leftRadius: number;
    rightRadius: number;
    assigned: boolean;
    actionInset?:number;
};
