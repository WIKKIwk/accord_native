type Obj = Record<string, any>;
type CardInput = {
  synchronized: boolean; activeOrder: boolean; allowed: readonly string[]; interaction: Obj;
  operation: string; previousStage: string; automaticQolip: boolean;
  preflightHold: boolean; preflightOutcome: boolean; preflightFreeze: boolean;
  materialLoading: boolean; materialError: string; assignedCount: number; materialBlockingText: string;
  intakeCount: number; reclose?: boolean;
};

/** @v2 _OrderStartUnifiedCard */
export function workerOrderCardState(input: CardInput) {
  const { synchronized, activeOrder, interaction, operation } = input;
  const allows = (action: string) => synchronized && input.allowed.includes(action);
  const showStart = allows('start'), showResume = allows('resume'), showPause = allows('pause');
  const showComplete = allows('complete') || (synchronized && input.reclose === true), showMerge = allows('merge');
  const showStartMaterials = synchronized && interaction.start_materials_mode === 'scan_required';
  const showIntakeCandidates = synchronized && !showStartMaterials && operation !== 'cut' && interaction.material_intake_allowed === true;
  const waitingForPrevious = synchronized && [interaction.previous_wip_mode, interaction.opening_wip_mode].includes('waiting');
  const reason = String(interaction.blocking_reason_code ?? '').trim();
  const showWaitingForPrevious = waitingForPrevious && !!input.previousStage.trim() && reason !== 'waiting_opening_wip';
  const showWaitingForSequence = synchronized && reason === 'waiting_sequence';
  const showBackendBlockingState = synchronized && !input.preflightOutcome && !!reason;
  const materialNoticeInSection = showStartMaterials && [
    'raw_material_assignment_required', 'raw_materials_missing', 'raw_material_groups_incomplete', 'raw_materials_not_at_apparatus',
  ].includes(reason) && (input.materialLoading || !!input.materialError.trim() || !input.assignedCount || !!input.materialBlockingText.trim());
  const hasActions = input.preflightHold || input.preflightOutcome || input.preflightFreeze || showStart || showPause ||
    showMerge || showComplete || showResume || waitingForPrevious || showWaitingForSequence;
  return {
    showStart, showResume, showPause, showComplete, showMerge, hasActions, showStartMaterials, showIntakeCandidates,
    // V2 renders this button inside hasActions, independently of the read-only candidate list.
    showMaterialIntakeAction: hasActions && showIntakeCandidates && input.intakeCount > 0,
    showWaitingForPrevious, showWaitingForSequence,
    showBackendBlockingNotice: showBackendBlockingState && activeOrder && !showWaitingForPrevious && !showWaitingForSequence && !materialNoticeInSection,
    showMolds: synchronized && interaction.qolip_mode === 'scan_required' &&
      (showStart || showResume || (input.automaticQolip && showBackendBlockingState)),
    showOutputProgress: showPause || showComplete || showResume,
  };
}

/** @v2 _workerStartMaterials */
export function workerStartMaterialStatus(assignments: Obj[], blockingText: string, notAtMachine: string, noMaterials: string) {
  const waiting = assignments.filter(row => row.execution_status === 'awaiting_delivery').length;
  const present = assignments.filter(row => ['ready', 'in_use'].includes(row.execution_status)).length;
  const allAwaiting = assignments.length > 0 && (waiting === assignments.length ||
    (blockingText === notAtMachine && assignments.every(row => ['', 'compatible', 'awaiting_delivery'].includes(row.execution_status ?? ''))));
  const unavailable = blockingText === notAtMachine || blockingText === noMaterials;
  return { allAwaiting, waiting, present, showBlockingReason: !!blockingText.trim() && !unavailable,
    deliveryKey: !allAwaiting && waiting > 0 ? (present > 0 ? 'worker.materials.delivery_progress' : 'worker.materials.awaiting_delivery_count')
      : !allAwaiting && unavailable ? 'worker.materials.not_ready' : '' };
}
