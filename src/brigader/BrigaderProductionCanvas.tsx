import { Fragment, useRef, useState, useLayoutEffect, type ComponentRef } from 'react';
import { View, StyleSheet } from 'react-native';
import { SymbolView } from 'expo-symbols';
import Svg, { Defs, Pattern, Path, Rect, Circle, Text as SvgText, Polygon } from 'react-native-svg';
import { GestureHandlerRootView, GestureDetector, usePanGesture, usePinchGesture, useSimultaneousGestures, useTapGesture } from 'react-native-gesture-handler';
import { useBaseTheme } from '../components/useBaseTheme';
import type { ProductionMapDraftNode as Node } from '../admin/productionMapDraftModel';
import type { BrigaderProductionMapModel } from './brigaderProductionMapModel';
import { productionEdgeGeometry } from './productionMapEdgeGeometry';
import { BrigaderProductionNode } from './BrigaderProductionNode';
import { isProductionRezka } from './productionMapApparatusPolicy';
type Point = {
    x: number;
    y: number;
};
type Transform = Point & {
    scale: number;
};
function Connection({ id, branch = '', owner, toCanvas, background }: {
    id: string;
    branch?: string;
    owner: BrigaderProductionMapModel;
    toCanvas: (x: number, y: number) => Point;
    background?: string;
}) { const last = useRef<Point | null>(null), gesture = usePanGesture({ enabled: !owner.args.readOnly && !owner.locked.has(id), runOnJS: true, minDistance: 0, maxPointers: 1, onActivate: event => { owner.startConnection(id, branch); last.current = toCanvas(event.absoluteX, event.absoluteY); owner.connectionPreview(last.current); }, onUpdate: event => { last.current = toCanvas(event.absoluteX, event.absoluteY); owner.connectionPreview(last.current); }, onDeactivate: event => { const point = last.current; last.current = null; if (event.canceled || !point)
        owner.cancelConnection();
    else
        owner.finishConnection(point); }, onFinalize: () => { if (last.current) {
        last.current = null;
        owner.cancelConnection();
    } } }); return <GestureDetector gesture={gesture}><View accessibilityLabel={branch ? `${branch === 'true' ? 'Shunda' : 'Aks holda'} yo‘liga qo‘l tortish` : undefined} style={{ width: 34, height: 34, borderRadius: 99, backgroundColor: background, alignItems: 'center', justifyContent: 'center' }}><SymbolView name={{ ios: 'link.badge.plus', android: 'add_link' }} size={20}/></View></GestureDetector>; }
function CanvasNode({ node, owner, scale, toCanvas, dragging }: {
    node: Node;
    owner: BrigaderProductionMapModel;
    scale: number;
    toCanvas: (x: number, y: number) => Point;
    dragging: (id: string | null) => void;
}) {
    const state = owner.getSnapshot(), locked = owner.locked.has(node.id), last = useRef<Point>({ x: 0, y: 0 }), pan = usePanGesture({ enabled: !owner.args.readOnly && !locked, runOnJS: true, minDistance: 1, maxPointers: 1, onActivate: () => { last.current = { x: 0, y: 0 }; dragging(node.id); }, onUpdate: event => { const next = { x: event.translationX / scale, y: event.translationY / scale }; owner.move(node.id, { x: next.x - last.current.x, y: next.y - last.current.y }); last.current = next; }, onFinalize: () => dragging(null) }), tap = useTapGesture({ enabled: !owner.args.readOnly && !locked, runOnJS: true, onDeactivate: event => { if (!event.canceled)
            void owner.edit(node.id); } }), gesture = useSimultaneousGestures(pan, tap), group = node.alternative_group_id.trim() ? state.nodes.filter(item => item.alternative_group_id.trim() === node.alternative_group_id.trim()).sort((a, b) => a.x - b.x) : [], index = group.findIndex(item => item.id === node.id), left = group.length <= 1 || index === 0 ? 28 : 2, right = group.length <= 1 || index === group.length - 1 ? 28 : 2, details = isProductionRezka(node, state.catalog) ? [node.rezka_kadr_count !== null ? `${node.rezka_kadr_count} kadr` : '', node.rezka_label_length !== null ? `etiketka ${node.rezka_label_length}` : ''].filter(Boolean).join(' • ') : '', subtitle = details || (node.formula ? (node.kind === 'condition' ? node.formula.expression : `${node.formula.target} = ${node.formula.expression}`) : node.role_code.trim() || node.item_code.trim() || node.kind);
    return <View style={{ position: 'absolute', left: node.x, top: node.y, width: 260, height: 60 }}><GestureDetector gesture={gesture}><View style={{ width: 260, height: 60 }}><BrigaderProductionNode title={node.title} subtitle={subtitle} kind={node.kind} actionInset={owner.args.readOnly||locked?0:['start','end'].includes(node.kind)?42:78} locked={locked} selected={state.connectingFrom === node.id} leftRadius={left} rightRadius={right} assigned={!!node.alternative_assigned_apparatus_id.trim() && node.alternative_assigned_apparatus_id.trim() === node.apparatus_id.trim()}/></View></GestureDetector>{!owner.args.readOnly && !locked ? <><View style={{ position: 'absolute', right: ['start', 'end'].includes(node.kind) ? 12 : 42, top: 13 }}><Connection id={node.id} owner={owner} toCanvas={toCanvas}/></View>{!['start', 'end'].includes(node.kind) ? <View style={{ position: 'absolute', right: 14, top: 13 }}><CanvasDelete label="" onPress={() => owner.delete(node.id)}/></View> : null}</> : null}</View>;
}
function CanvasDelete({ label, onPress, locked = false }: {
    label: string;
    onPress: () => void;
    locked?: boolean;
}) { const tap = useTapGesture({ enabled: !locked, runOnJS: true, onDeactivate: event => { if (!event.canceled)
        onPress(); } }); return <GestureDetector gesture={tap}><View accessibilityLabel={label} accessibilityRole="button" style={{ width: 26, height: 26, alignItems: 'center', justifyContent: 'center' }}><SymbolView name={{ ios: locked ? 'lock' : 'xmark', android: locked ? 'lock_outline' : 'close' }} size={17}/></View></GestureDetector>; }
export function BrigaderProductionCanvas({ owner }: {
    owner: BrigaderProductionMapModel;
}) {
    const state = owner.getSnapshot(), { colors, mode } = useBaseTheme(), root = useRef<ComponentRef<typeof View>>(null), bounds = useRef({ x: 0, y: 0, width: 0, height: 0 }), initialized = useRef(false), drag = useRef<string | null>(null), [transform, setTransform] = useState<Transform>({ x: 0, y: 0, scale: 1 }), actual = useRef(transform), panStart = useRef(transform), pinchStart = useRef(transform);
    useLayoutEffect(() => { actual.current = transform; }, [transform]);
    const canvas = { width: Math.max(1180, ...state.nodes.map(node => node.x + 580)), height: Math.max(900, ...state.nodes.map(node => node.y + 420)) }, clamp = (next: Transform) => ({ ...next, x: Math.max(bounds.current.width - (canvas.width + 760) * next.scale, Math.min(760 * next.scale, next.x)), y: Math.max(bounds.current.height - (canvas.height + 760) * next.scale, Math.min(760 * next.scale, next.y)) }), toCanvas = (x: number, y: number) => ({ x: (x - bounds.current.x - actual.current.x) / actual.current.scale, y: (y - bounds.current.y - actual.current.y) / actual.current.scale }), pan = usePanGesture({ runOnJS: true, maxPointers: 1, onActivate: () => { panStart.current = actual.current; }, onUpdate: event => { if (!drag.current && !state.connectingFrom)
            setTransform(clamp({ ...actual.current, x: panStart.current.x + event.translationX, y: panStart.current.y + event.translationY })); } }), pinch = usePinchGesture({ runOnJS: true, onActivate: () => { drag.current = null; pinchStart.current = actual.current; }, onUpdate: event => { const old = pinchStart.current, scale = Math.max(.45, Math.min(2.4, old.scale * event.scale)), ratio = scale / old.scale; setTransform(clamp({ scale, x: event.focalX - (event.focalX - old.x) * ratio, y: event.focalY - (event.focalY - old.y) * ratio })); } }), gesture = useSimultaneousGestures(pan, pinch), edgeColor = (branch: string) => branch === 'true' ? colors.primary : branch === 'false' ? colors.error : colors.onSurfaceVariant;
    const measure = () => root.current?.measureInWindow((x, y, width, height) => { bounds.current = { x, y, width, height }; if (initialized.current || !width || !state.nodes.length)
        return; initialized.current = true; const minX = Math.min(...state.nodes.map(node => node.x)), maxX = Math.max(...state.nodes.map(node => node.x + 260)), top = Math.min(...state.nodes.map(node => node.y)), scale = Math.max(.88, Math.min(1.08, width / (maxX - minX + 112))), minDx = width - canvas.width * scale, minDy = height - canvas.height * scale; setTransform({ scale, x: Math.max(minDx, Math.min(Math.max(minDx, 56), width / 2 - (minX + maxX) / 2 * scale)), y: Math.max(minDy, Math.min(Math.max(minDy, 56), 56 - top * scale)) }); });
    return <GestureHandlerRootView style={{ flex: 1 }}><View ref={root} collapsable={false} onLayout={measure} style={{ flex: 1, overflow: 'hidden', backgroundColor: colors.surfaceContainerLowest }}><Svg width="100%" height="100%" style={StyleSheet.absoluteFill}><Defs><Pattern id="production-grid" width={40} height={40} patternUnits="userSpaceOnUse"><Path d="M 40 0 L 0 0 0 40" fill="none" stroke={mode === 'dark' ? colors.onSurface : colors.outlineVariant} strokeOpacity={mode === 'dark' ? .24 : .42} strokeWidth={1}/></Pattern></Defs><Rect width="100%" height="100%" fill="url(#production-grid)"/></Svg><GestureDetector gesture={gesture}><View style={StyleSheet.absoluteFill}><View style={{ width: canvas.width, height: canvas.height, transformOrigin: [0, 0, 0], transform: [{ translateX: transform.x }, { translateY: transform.y }, { scale: transform.scale }] }}>
 <Svg width={canvas.width} height={canvas.height} style={StyleSheet.absoluteFill}>{state.edges.map((edge, index) => { const from = state.nodes.find(node => node.id === edge.from), to = state.nodes.find(node => node.id === edge.to); if (!from || !to)
        return null; const shape = productionEdgeGeometry(from, to, edge.branch.trim().toLowerCase()), color = edgeColor(edge.branch), angle = Math.atan2(shape.end.y - shape.start.y, shape.end.x - shape.start.x), arrow = [0, 2.6, -2.6].map((offset, index) => index ? `${shape.end.x + 11 * Math.cos(angle + offset)},${shape.end.y + 11 * Math.sin(angle + offset)}` : `${shape.end.x},${shape.end.y}`).join(' '); return <Fragment key={index}><Path d={shape.path} stroke={color} strokeOpacity={.76} strokeWidth={3} fill="none"/><Circle cx={shape.start.x} cy={shape.start.y} r={6} fill={color}/><Polygon points={arrow} fill={color}/>{edge.branch ? <SvgText x={shape.middle.x} y={shape.middle.y - 16} textAnchor="middle" fill={color} fontSize={12}>{edge.branch === 'true' ? 'Shunda' : edge.branch === 'false' ? 'Aks holda' : edge.branch}</SvgText> : null}</Fragment>; })}{state.connectingFrom && state.preview ? (() => { const from = state.nodes.find(node => node.id === state.connectingFrom); if (!from)
        return null; const shape = productionEdgeGeometry(from, state.preview, state.connectingBranch); return <><Path d={shape.path} stroke={edgeColor(state.connectingBranch)} strokeWidth={3} fill="none"/><Circle cx={shape.end.x} cy={shape.end.y} r={7} fill={colors.primary}/></>; })() : null}</Svg>
 {state.edges.map((edge, index) => { if (owner.args.readOnly)
        return null; const from = state.nodes.find(node => node.id === edge.from), to = state.nodes.find(node => node.id === edge.to); if (!from || !to)
        return null; const point = productionEdgeGeometry(from, to, edge.branch).middle; return <View key={index} style={{ position: 'absolute', left: point.x - 13, top: point.y - 13 }}><CanvasDelete label="" locked={owner.locked.has(edge.to.trim())} onPress={() => owner.removeEdge(edge)}/></View>; })}
 {state.nodes.map(node => <CanvasNode key={node.id} node={node} owner={owner} scale={transform.scale} toCanvas={toCanvas} dragging={id => { drag.current = id; }}/>)}{!owner.args.readOnly ? state.nodes.filter(node => node.kind === 'condition').flatMap(node => ['true', 'false'].map(branch => <View key={`${node.id}:${branch}`} style={{ position: 'absolute', left: Math.max(8, node.x + (branch === 'true' ? -17 : 243)), top: node.y + 13 }}><Connection id={node.id} branch={branch} owner={owner} toCanvas={toCanvas} background={branch === 'true' ? colors.primaryContainer : colors.errorContainer}/></View>)) : null}
 </View></View></GestureDetector></View></GestureHandlerRootView>;
}
