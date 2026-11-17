import { useEffect,useLayoutEffect,useMemo,useState,useSyncExternalStore } from 'react';
import { usePreventRemove } from 'expo-router';
import { subscribeSessionWitness } from '../auth';
import { appRoutes } from '../shared/appRoutes';
import { adminText } from '../shared/localization';
import { localeController } from '../shared/localization/runtime';
import { useWorkerPrinterSelector } from '../components/useWorkerPrinterSelector';
import { pickPreparationPrinter,printPreparationJob } from '../preparation/preparationPrinter';
import { offlineUsbDriverUrl } from '../printing/printTransport';
import { adminPrintOpeningWip } from '../workerOpeningWipPrintApi';
import { useBrigaderFeature } from './BrigaderFeatureContext';
import { useBrigaderSnackMessage } from './useBrigaderSnackMessage';
import { BrigaderOpeningWipModel,type OpeningBatch } from './brigaderOpeningWipModel';
class PrinterSelection {
  constructor(private select:ReturnType<typeof useWorkerPrinterSelector>['selectDevice']) {}
  update(select:typeof this.select) { this.select = select; }
  choose = () => this.select();
}
export function useBrigaderOpeningWip() {
  const page = useBrigaderFeature(appRoutes.adminOpeningWip),{ current,interactive,shell } = page,selector = useWorkerPrinterSelector(current),message = useBrigaderSnackMessage(current,false),[selection] = useState(() => new PrinterSelection(selector.selectDevice));
  useLayoutEffect(() => { selection.update(selector.selectDevice); },[selection,selector.selectDevice]);
  const print = useMemo(() => ({ pick:() => pickPreparationPrinter({ isCurrent:current,selectDevice:selection.choose }),batch:async (batch:OpeningBatch,raw:unknown) => {
    const printer = raw as NonNullable<Awaited<ReturnType<typeof pickPreparationPrinter>>>;const guard = () => { if (!current()) throw Error('Original Opening WIP page expired'); };
    const fields = printer.transport === 'wifi' ? { driver_url:printer.driverBaseUrl ?? printer.serverBaseUrl,printer:'printer' in printer ? printer.printer : '',print_mode:'printMode' in printer ? printer.printMode : '' } : { driver_url:offlineUsbDriverUrl,printer:printer.printer.printer,print_mode:printer.printer.printMode };
    guard();const result = await adminPrintOpeningWip(shell.session,{ batch_id:batch.batch_id,qr_payload:batch.qr_payload,...fields,print_count:1,print_transport:printer.transport },guard);guard();
    if (!result.ok) throw Error(result.print_status);if (printer.transport === 'wifi') return;if (!result.print_job) throw Error('Opening WIP print job missing');
    if (!await printPreparationJob(result.print_job,printer)) throw Error('Opening WIP print failed');guard();
  } }),[current,selection,shell.session]);
  const owner = useMemo(() => new BrigaderOpeningWipModel(shell.session,current,interactive,(key,values) => adminText(key,localeController.locale,values),message,print),[shell.session,current,interactive,message,print]),state = useSyncExternalStore(owner.subscribe,owner.getSnapshot,owner.getSnapshot);
  useEffect(() => { const detach = owner.attach(() => { void owner.load(); }),stop = subscribeSessionWitness(() => { if (!shell.isCurrent()) owner.dispose(); });return () => { stop();detach(); }; },[owner,shell]);
  usePreventRemove(state.submitting && current(),() => {});
  return { page,owner,state,printerDialogs:selector.dialogs };
}
