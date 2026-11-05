import { savedAccountId, type AccountStorage } from '../savedAccountStore';

type PinAccount = { baseUrl: string; profile: Record<string, unknown> };
/** @v2 SecurityController.saveSwitchPinForCurrentUser */
/** @v2 SecurityController.verifySwitchPinForProfile */
export class SwitchPinStore {
  constructor(private readonly storage: AccountStorage, private readonly sha256: (value: string) => Promise<string>) {}

  private async key(account: PinAccount): Promise<string> {
    return `security_switch_pin_hash_${await this.sha256(savedAccountId(account.baseUrl, account.profile))}`;
  }
  async has(account: PinAccount): Promise<boolean> {
    return !!(await this.storage.getItem(await this.key(account)));
  }
  async save(account: PinAccount, pin: string): Promise<void> {
    const normalized = pin.trim();
    if (!/^\d{4}$/.test(normalized)) throw new Error('PIN 4 xonali bo‘lishi kerak');
    await this.storage.setItem(await this.key(account), await this.sha256(normalized));
  }
  async verify(account: PinAccount, pin: string): Promise<boolean> {
    const normalized = pin.trim();
    if (!/^\d{4}$/.test(normalized)) return false;
    const stored = await this.storage.getItem(await this.key(account));
    return !!stored && stored === await this.sha256(normalized);
  }
  async clear(account: PinAccount): Promise<void> {
    await this.storage.removeItem(await this.key(account));
  }
}
