/**
 * Required external evaluator. It must accept only a synchronous literal true,
 * absorb rejected thenables, and validate the captured account identity, read
 * scope and generation before and after invoking the supplied callback.
 * No production implementation or fallback is provided on this branch.
 */
export type WerkaGuardEvaluator = (guard: () => boolean) => boolean;
