/** Focus can pause native actions without retiring the captured account read owner. */
export class ItemGroupsInteraction {
  private focused = false;
  setFocused(value: boolean) { this.focused = value; }
  readonly canInteract = () => this.focused;
}
