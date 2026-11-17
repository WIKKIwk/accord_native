import { savedAccountId, type AccountStorage } from '../savedAccountStore';

type PinAccount = { baseUrl: string; profile: Record<string, unknown> };
type PinGuard = () => boolean;
function checkCurrent(current?: PinGuard): void {
  if (current && current() !== true) throw new Error('Akkaunt o‘zgargan');
}
/** @v2 SecurityController.saveSwitchPinForCurrentUser */
/** @v2 SecurityController.verifySwitchPinForProfile */
export class SwitchPinStore {
  constructor(private readonly storage: AccountStorage, private readonly sha256: (value: string) => Promise<string>) {}

  private async key(account: PinAccount): Promise<string> {
    return `security_switch_pin_hash_${await this.sha256(savedAccountId(account.baseUrl, account.profile))}`;
  }
  async has(account: PinAccount, current?: PinGuard): Promise<boolean> {
    checkCurrent(current);
    const key = await this.key(account); checkCurrent(current);
    const stored = await this.storage.getItem(key); checkCurrent(current);
    return !!stored;
  }
  async save(account: PinAccount, pin: string, current?: PinGuard): Promise<void> {
    checkCurrent(current);
    const normalized = pin.trim();
    if (!/^\d{4}$/.test(normalized)) throw new Error('PIN 4 xonali bo‘lishi kerak');
    const key = await this.key(account); checkCurrent(current);
    const hash = await this.sha256(normalized); checkCurrent(current);
    await this.storage.setItem(key, hash); checkCurrent(current);
  }
  async verify(account: PinAccount, pin: string): Promise<boolean> {
    const normalized = pin.trim();
    if (!/^\d{4}$/.test(normalized)) return false;
    const stored = await this.storage.getItem(await this.key(account));
    return !!stored && stored === await this.sha256(normalized);
  }
  async clear(account: PinAccount, current?: PinGuard): Promise<void> {
    checkCurrent(current);
    const key = await this.key(account); checkCurrent(current);
    await this.storage.removeItem(key); checkCurrent(current);
  }
}
