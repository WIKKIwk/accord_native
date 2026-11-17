import type { ProductionMapDraftNode as Node } from '../admin/productionMapDraftModel';
export type CanvasPoint = {
    x: number;
    y: number;
};
export const productionNodeSize = { width: 260, height: 60 };
export const clampProductionNode = (point: CanvasPoint) => ({ x: Math.min(6000, Math.max(-2400, point.x)), y: Math.min(6000, Math.max(-1600, point.y)) });
const overlaps = (a: CanvasPoint, b: CanvasPoint) => a.x - 9 < b.x + 269 && a.x + 269 > b.x - 9 && a.y - 9 < b.y + 69 && a.y + 69 > b.y - 9;
export function firstFreeProductionPosition(nodes: readonly Node[], node: Node, ignore: ReadonlySet<string> = new Set(), extra: readonly Node[] = []): CanvasPoint { const origin = clampProductionNode(node), tried = new Set<string>(); for (let row = 0; row < 80; row++)
    for (const column of [0, -1, 1, -2, 2, -3, 3, -4, 4]) {
        const position = clampProductionNode({ x: origin.x + column * 280, y: origin.y + row * 132 }), key = `${position.x}:${position.y}`;
        if (tried.has(key))
            continue;
        tried.add(key);
        if (![...nodes, ...extra].some(other => other.id !== node.id && !ignore.has(other.id) && overlaps(position, other)))
            return position;
    } return origin; }
/** Source eighty-pass collision separation, followed by deterministic row repacking. */
export function resolveProductionOverlaps(input: readonly Node[], anchor: string, locked: ReadonlySet<string>): Node[] { const nodes = input.map(node => ({ ...node })), move = (index: number, dx: number, dy: number) => { if (!locked.has(nodes[index].id))
    Object.assign(nodes[index], clampProductionNode({ x: nodes[index].x + dx, y: nodes[index].y + dy })); }; for (let pass = 0; pass < 80; pass++) {
    let moved = false;
    for (let a = 0; a < nodes.length; a++)
        for (let b = a + 1; b < nodes.length; b++) {
            const left = nodes[a], right = nodes[b];
            if (!overlaps(left, right) || locked.has(left.id) && locked.has(right.id))
                continue;
            const ox = Math.min(left.x + 269 - (right.x - 9), right.x + 269 - (left.x - 9)), oy = Math.min(left.y + 69 - (right.y - 9), right.y + 69 - (left.y - 9));
            if (ox <= 0 || oy <= 0)
                continue;
            const dx = ox <= oy ? (ox + .5) * (right.x >= left.x ? 1 : -1) : 0, dy = ox <= oy ? 0 : (oy + .5) * (right.y >= left.y ? 1 : -1);
            moved = true;
            if (locked.has(left.id) || left.id === anchor)
                move(b, dx, dy);
            else if (locked.has(right.id) || right.id === anchor)
                move(a, -dx, -dy);
            else {
                move(a, -dx / 2, -dy / 2);
                move(b, dx / 2, dy / 2);
            }
        }
    if (!moved)
        break;
} for (let pass = 0; pass < nodes.length; pass++) {
    let changed = false;
    for (let i = 0; i < nodes.length; i++) {
        const node = nodes[i];
        if (node.id === anchor || locked.has(node.id) || !nodes.some(other => other.id !== node.id && overlaps(node, other)))
            continue;
        const position = firstFreeProductionPosition(nodes, node);
        if (position.x !== node.x || position.y !== node.y) {
            nodes[i] = { ...node, ...position };
            changed = true;
        }
    }
    if (!changed)
        break;
} return nodes; }
