import { currentSession } from '../auth';
import { appPreferences } from '../appPreferences';

type Preferences = { getItem: (key: string) => Promise<string | null>; setItem: (key: string, value: string) => Promise<void> };
type Apparatus = { id: string; name: string };

/** @v2 AdminSequenceApparatusStore */
export class AdminSequenceApparatusStore {
  private id: string | null = null;
  private name: string | null = null;
  private generation = 0;
  constructor(private readonly preferences: Preferences = appPreferences,
    private readonly profileRef: () => string | null = () => String(currentSession()?.profile.ref ?? '')) {}
  get cachedApparatusId() { return this.id; }
  get cachedApparatusName() { return this.name; }
  preferenceKey(profileRef?: string | null) {
    const ref = (profileRef ?? this.profileRef() ?? '').trim();
    return `accord_v4_admin.production_map.sequence_apparatus.${ref || 'default'}`;
  }
  preferenceNameKey(profileRef?: string | null) { return `${this.preferenceKey(profileRef)}_name`; }
  async loadSavedApparatusId(profileRef?: string | null): Promise<string | null> {
    const generation = this.generation;
    const ref = profileRef ?? this.profileRef();
    try {
      let id = (await this.preferences.getItem(this.preferenceKey(ref)))?.trim();
      let name = (await this.preferences.getItem(this.preferenceNameKey(ref)))?.trim();
      if (!id && (ref ?? '').trim()) {
        id = (await this.preferences.getItem(this.preferenceKey('default')))?.trim();
        name = (await this.preferences.getItem(this.preferenceNameKey('default')))?.trim();
      }
      if (generation !== this.generation) return null;
      if (id) this.id = id;
      if (name) this.name = name;
    } catch { /* Preferences are optional, as in V2. */ }
    return generation === this.generation ? this.id : null;
  }
  async saveApparatus(apparatus: Apparatus, profileRef?: string | null): Promise<void> {
    const id = apparatus.id.trim(), name = apparatus.name.trim();
    this.id = id || null; this.name = name || null;
    try {
      if (id) {
        await this.preferences.setItem(this.preferenceKey(profileRef), id);
        await this.preferences.setItem(this.preferenceKey('default'), id);
      }
      if (name) {
        await this.preferences.setItem(this.preferenceNameKey(profileRef), name);
        await this.preferences.setItem(this.preferenceNameKey('default'), name);
      }
    } catch { /* Keep the in-memory selection when storage fails. */ }
  }
  resolveApparatus<T extends Apparatus>(list: Iterable<T>, id?: string | null, name?: string | null): T | null {
    const targetId = (id ?? this.id ?? '').trim(), targetName = (name ?? this.name ?? '').trim();
    if (!targetId && !targetName) return null;
    const values = [...list];
    return (targetId ? values.find(item => item.id.trim() === targetId) : undefined) ??
      (targetName ? values.find(item => item.name.trim().toLowerCase() === targetName.toLowerCase()) : undefined) ?? null;
  }
  clearCache() { this.generation++; this.id = null; this.name = null; }
}

export const adminSequenceApparatusStore = new AdminSequenceApparatusStore();
