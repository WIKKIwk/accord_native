/** @v2 CustomerDeliveryResponseMode */
export type CustomerDeliveryResponseMode = 'acceptAll' | 'acceptPartial' | 'rejectAll' | 'claimAfterAccept';

export type CustomerDeliveryResponse = {
  deliveryNoteID: string;
  approve?: boolean | null;
  mode?: CustomerDeliveryResponseMode | null;
  acceptedQty?: number | null;
  returnedQty?: number | null;
  reason?: string;
  comment?: string;
};

/** @v2 customerDeliveryResponseModeApiValue */
export function customerDeliveryResponseModeApiValue(mode: CustomerDeliveryResponseMode): string {
  switch (mode) {
    case 'acceptAll': return 'accept_all';
    case 'acceptPartial': return 'accept_partial';
    case 'rejectAll': return 'reject_all';
    case 'claimAfterAccept': return 'claim_after_accept';
  }
}

/** Builds the request body in MobileApiCustomer.customerRespondDelivery. */
export function customerDeliveryResponseBody(response: CustomerDeliveryResponse): Record<string, string | boolean | number> {
  const body: Record<string, string | boolean | number> = {
    delivery_note_id: response.deliveryNoteID,
    reason: response.reason ?? '',
  };
  if (response.approve != null) body.approve = response.approve;
  if (response.mode != null) body.mode = customerDeliveryResponseModeApiValue(response.mode);
  // Dart jsonEncode rejects non-finite numbers instead of converting them to null.
  if (response.acceptedQty != null) {
    if (!Number.isFinite(response.acceptedQty)) throw new TypeError('Invalid accepted quantity');
    body.accepted_qty = response.acceptedQty;
  }
  if (response.returnedQty != null) {
    if (!Number.isFinite(response.returnedQty)) throw new TypeError('Invalid returned quantity');
    body.returned_qty = response.returnedQty;
  }
  const comment = response.comment?.trim() ?? '';
  if (comment) body.comment = comment;
  return body;
}

/** @v2 _CustomerDeliveryDetailScreenState._parseQty */
export function parseCustomerReturnQty(raw: string): number | null {
  const normalized = raw.trim().replaceAll(',', '.');
  if (!/^[+-]?(?:(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?|Infinity|NaN)$/.test(normalized)) return null;
  if (/^[+-]?NaN$/.test(normalized)) return NaN;
  return Number(normalized);
}

export type CustomerReturnInput = { returnedQty: number; reason: string; comment: string };
export type CustomerReturnDialogValues = {
  sentQty: number;
  rawQty: string;
  selectedReason: string | null;
  comment: string;
  allowFullReturn: boolean;
  requireQtyEntry: boolean;
};

/** @v2 _CustomerDeliveryDetailScreenState._showReturnDialog */
export function customerReturnInput(values: CustomerReturnDialogValues): CustomerReturnInput | null {
  const reason = (values.selectedReason ?? '').trim();
  const comment = values.comment.trim();
  const qty = parseCustomerReturnQty(values.rawQty);
  const validQty = !values.requireQtyEntry || (qty !== null && qty > 0 &&
    (values.allowFullReturn ? qty <= values.sentQty : qty < values.sentQty));
  if (!validQty || (!reason && Array.from(comment).length < 3)) return null;
  return { returnedQty: values.requireQtyEntry ? qty ?? values.sentQty : values.sentQty, reason, comment };
}

/** @v2 _CustomerDeliveryDetailScreenState._approveAll */
export function customerApproveAll(deliveryNoteID: string): CustomerDeliveryResponse {
  return { deliveryNoteID, approve: true, mode: 'acceptAll' };
}

/** @v2 _CustomerDeliveryDetailScreenState._rejectAll */
export function customerRejectAll(deliveryNoteID: string, sentQty: number, input: CustomerReturnInput): CustomerDeliveryResponse {
  return { deliveryNoteID, approve: false, mode: 'rejectAll', returnedQty: sentQty, reason: input.reason, comment: input.comment };
}

/** @v2 _CustomerDeliveryDetailScreenState._acceptPartial */
export function customerAcceptPartial(deliveryNoteID: string, sentQty: number, input: CustomerReturnInput): CustomerDeliveryResponse {
  return { deliveryNoteID, mode: 'acceptPartial', acceptedQty: sentQty - input.returnedQty,
    returnedQty: input.returnedQty, reason: input.reason, comment: input.comment };
}

/** @v2 _CustomerDeliveryDetailScreenState._reportClaim */
export function customerReportClaim(deliveryNoteID: string, input: CustomerReturnInput): CustomerDeliveryResponse {
  return { deliveryNoteID, mode: 'claimAfterAccept', returnedQty: input.returnedQty, reason: input.reason, comment: input.comment };
}
