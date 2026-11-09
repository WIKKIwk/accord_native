/** Only events from the currently committed camera generation may reach a role. */
export class CameraSurfaceGate {
  private current: object | null = null;
  activate(generation: object): void { this.current = generation; }
  deactivate(generation: object): void { if (this.current === generation) this.current = null; }
  deliver<T>(generation: object, value: T, receive: (event: T) => void): void {
    if (this.current === generation) receive(value);
  }
}
