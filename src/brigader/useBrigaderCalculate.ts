import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { Keyboard, Platform } from 'react-native';
import { router, type Href } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { File } from 'expo-file-system';
import { subscribeSessionWitness } from '../auth';
import { appRoutes, canOpenRoute } from '../shared/appRoutes';
import type { CalculateOrderTemplate } from '../admin/calculateOrderTemplateModel';
import type { SupplierItem } from '../shared/catalogApi';
import { useBrigaderFeature } from './BrigaderFeatureContext';
import { useBrigaderFlows } from './BrigaderFlowProvider';
import { useBrigaderCalculateStore } from './BrigaderCalculateStore';
import { useBrigaderNotice } from './useBrigaderNotice';
import { BrigaderCalculateArgs } from './brigaderCalculateArgs';
import { BrigaderCalculateModel, type CalculatePageActions } from './brigaderCalculateModel';
export function useBrigaderCalculate() {
    const page = useBrigaderFeature(appRoutes.adminCalculate), { current, interactive, shell, back } = page, store = useBrigaderCalculateStore(), flows = useBrigaderFlows(), notice = useBrigaderNotice(), [args] = useState(() => page.args instanceof BrigaderCalculateArgs ? page.args : new BrigaderCalculateArgs());
    const actions = useMemo<CalculatePageActions>(() => ({ back, openMap: args => flows.open<CalculateOrderTemplate>({ route: appRoutes.adminProductionMapTest, args }, { isCurrent: current, canInteract: current }), createProduct: () => flows.open<SupplierItem>({ route: appRoutes.adminItemCreate, args: { initialItemGroup: 'Tayyor mahsulot', openCreateDialog: true, returnOnCreate: true } }, { isCurrent: current, canInteract: current }), canCreateProduct: () => current() && flows.supportsRoute(appRoutes.adminItemCreate) && canOpenRoute(shell.session, appRoutes.adminItemCreate), pickImage: async () => { if (!interactive())
            return null; Keyboard.dismiss(); const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 }); if (result.canceled || !result.assets[0] || !current())
            return null; const asset = result.assets[0], context = ImageManipulator.manipulate(asset.uri, { maxWidth: 1800, maxHeight: 1800 }); let image: Awaited<ReturnType<typeof context.renderAsync>> | undefined; try {
            image = await context.renderAsync();
            const output = await image.saveAsync({ format: SaveFormat.JPEG, compress: .84 });
            if (!current())
                return null;
            return { uri: output.uri, filename: asset.fileName ?? new File(asset.uri).name, bytes: await new File(output.uri).bytes() };
        }
        finally {
            image?.release();
            context.release();
        } } }), [back, flows, current, interactive, shell.session]);
    const owner = useMemo(() => new BrigaderCalculateModel(shell.session, store, args, current, interactive, notice, actions), [shell.session, store, args, current, interactive, notice, actions]), state = useSyncExternalStore(owner.subscribe, owner.getSnapshot, owner.getSnapshot);
    useEffect(() => { const detach = owner.attach(owner.start), stop = subscribeSessionWitness(() => { if (!shell.isCurrent())
        owner.dispose(); }); return () => { stop(); detach(); }; }, [owner, shell]);
    const go = useCallback((route: string) => { if (!interactive())
        return; Keyboard.dismiss(); const path = shell.destination(route, Platform.OS); if (path)
        router.push(path as Href); }, [shell, interactive]);
    return { page, owner, state, go };
}
