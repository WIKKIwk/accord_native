/** Clear the field only if the user did not change it while saving. */
export function draftAfterSending(sent: string, current: string): string {
  'worklet';
  return current === sent ? '' : current;
}
