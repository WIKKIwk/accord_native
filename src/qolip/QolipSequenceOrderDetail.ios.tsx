import { QolipSequenceOrderDetailContent } from './QolipSequenceOrderDetailContent';
import { useQolipSequenceOrderDetail, type QolipSequenceOrderDetailProps } from './useQolipSequenceOrderDetail';
/** @v2 _ReadOnlyOrderDetailSheet (non-worker Qolip sequence) */
export function QolipSequenceOrderDetail(props: QolipSequenceOrderDetailProps) {
  return <QolipSequenceOrderDetailContent state={useQolipSequenceOrderDetail(props)} />;
}
