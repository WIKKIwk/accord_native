import { useWorkerQrScanner, type WorkerQrScannerProps } from './useWorkerQrScanner';
import { WorkerQrScannerView } from './WorkerQrScannerView';

export function WorkerQrScanner(props: WorkerQrScannerProps) {
  const model = useWorkerQrScanner(props);
  return <WorkerQrScannerView model={model} />;
}
