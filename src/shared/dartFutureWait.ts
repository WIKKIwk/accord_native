/** Dart Future.wait defaults to eagerError:false and reports the first completed failure. */
export async function dartFutureWait<T extends readonly unknown[]>(tasks: { [K in keyof T]: Promise<T[K]> }): Promise<T> {
  let failed = false, firstError: unknown;
  const values = await Promise.allSettled(tasks.map(task => task.catch(error => { if (!failed) { failed = true; firstError = error; } throw error; })));
  if (failed) throw firstError;
  return values.map(result => (result as PromiseFulfilledResult<unknown>).value) as unknown as T;
}
