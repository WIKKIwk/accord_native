import Storage from 'expo-sqlite/kv-store';

export type ApparatusTransferCommand = { order_id: string; from_apparatus: string; to_apparatus: string; reason: string; idempotency_key: string };
let writes: Promise<unknown> = Promise.resolve();
const key = (scope: string, command: ApparatusTransferCommand) =>
  `apparatus_transfer_pending_v1:${JSON.stringify([scope, command.order_id, command.from_apparatus, command.to_apparatus])}`;
function ordered<T>(work: () => Promise<T>): Promise<T> {
  const result = writes.then(work);
  writes = result.then(() => undefined, () => undefined);
  return result;
}
export function retainTransferCommand(scope: string, command: ApparatusTransferCommand): Promise<ApparatusTransferCommand> {
  return ordered(async () => {
    const storageKey = key(scope, command), current = await Storage.getItem(storageKey);
    if (current !== null) return JSON.parse(current) as ApparatusTransferCommand;
    await Storage.setItem(storageKey, JSON.stringify(command));
    return command;
  });
}
export function acknowledgeTransferCommand(scope: string, command: ApparatusTransferCommand): Promise<void> {
  return ordered(async () => {
    const storageKey = key(scope, command);
    if (await Storage.getItem(storageKey) === JSON.stringify(command)) await Storage.removeItem(storageKey);
  });
}
