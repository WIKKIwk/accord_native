import { currentSession, type Session } from '../auth';
import { sessionReadScope } from '../sessionReadScope';
import { calculateOrderTemplates, deleteCalculateOrderTemplate, upsertCalculateOrderTemplate, type CalculateOrderTemplate } from './calculateOrderTemplateApi';
import { dartPartialLower, dartTrim } from './dartJsonString';

export type { CalculateOrderTemplate } from './calculateOrderTemplateApi';
export type CalculateOrderTemplateClient = {
  listTemplates: () => Promise<readonly CalculateOrderTemplate[]>;
  upsertTemplate: (template: CalculateOrderTemplate) => Promise<CalculateOrderTemplate>;
  deleteTemplate: (id: string) => Promise<void>;
};
export type CalculateOrderTemplateStoreScope = Readonly<{ scope: string; generation: number }>;
type Mutation = (templates: readonly CalculateOrderTemplate[]) => readonly CalculateOrderTemplate[];
type ArchiveRead = { scope: CalculateOrderTemplateStoreScope; mutations: Mutation[]; future: Promise<void> };

export function calculateOrderTemplateClient(session: Session, guard?: () => void, readWitness?: () => boolean): CalculateOrderTemplateClient {
  return { listTemplates: () => calculateOrderTemplates(session, guard, readWitness),
    upsertTemplate: template => upsertCalculateOrderTemplate(session, template, guard),
    deleteTemplate: id => deleteCalculateOrderTemplate(session, id, guard) };
}
function activeClient(): CalculateOrderTemplateClient {
  const session = currentSession();
  if (!session) throw new Error('Calculate template session unavailable');
  return calculateOrderTemplateClient(session);
}
const mobileClient: CalculateOrderTemplateClient = {
  listTemplates: () => activeClient().listTemplates(), upsertTemplate: template => activeClient().upsertTemplate(template),
  deleteTemplate: id => activeClient().deleteTemplate(id),
};
const currentScope = () => { const session = currentSession(); return session ? sessionReadScope(session) : 'no-session'; };

/** @v2 _dedupeTemplates */
export function dedupeCalculateOrderTemplates(templates: readonly CalculateOrderTemplate[]): readonly CalculateOrderTemplate[] {
  const seen = new Set<string>(), result: CalculateOrderTemplate[] = [];
  for (const template of templates) {
    const code = dartPartialLower(dartTrim(template.code)), key = code ? `code:${code}` : `id:${dartTrim(template.id)}`;
    if (key === 'id:' || !seen.has(key)) { result.push(template); seen.add(key); }
  }
  return Object.freeze(result);
}

/** @v2 CalculateOrderTemplateStore */
export class CalculateOrderTemplateStore {
  static readonly instance = new CalculateOrderTemplateStore();
  private readonly client: CalculateOrderTemplateClient;
  private readonly readScope: () => string;
  private values: readonly CalculateOrderTemplate[] = Object.freeze([]);
  private scope: string | null = null;
  private generation = 0;
  private archiveRead: ArchiveRead | null = null;
  private loaded = false;
  private disposed = false;
  private version = 0;
  private readonly listeners = new Set<() => void>();
  constructor(options: { client?: CalculateOrderTemplateClient; readScope?: () => string } = {}) {
    this.client = options.client ?? mobileClient; this.readScope = options.readScope ?? currentScope;
  }
  get templates(): readonly CalculateOrderTemplate[] { this.synchronizeScope(); return this.values; }
  get isLoaded(): boolean { this.synchronizeScope(); return this.loaded; }
  getSnapshot = (): number => this.version;
  subscribe = (listener: () => void): (() => void) => { this.listeners.add(listener); return () => this.listeners.delete(listener); };
  private notify() {
    if (this.disposed) return; this.version++;
    for (const listener of this.listeners) {
      try { listener(); } catch { /* ChangeNotifier reports observer errors without failing the committed operation. */ }
    }
  }
  captureScope(): CalculateOrderTemplateStoreScope { return Object.freeze({ scope: this.synchronizeScope(), generation: this.generation }); }
  isCurrentScope(scope: CalculateOrderTemplateStoreScope): boolean {
    return !this.disposed && scope.scope === this.synchronizeScope() && scope.generation === this.generation;
  }
  load({ force = false }: { force?: boolean } = {}): Promise<void> {
    const scope = this.captureScope();
    if (this.loaded && !force) return Promise.resolve();
    if (this.archiveRead) return this.archiveRead.future;
    const read: ArchiveRead = { scope, mutations: [], future: Promise.resolve() };
    this.archiveRead = read; read.future = this.loadArchive(read);
    return read.future;
  }
  private async loadArchive(read: ArchiveRead): Promise<void> {
    try {
      let templates = dedupeCalculateOrderTemplates(await this.client.listTemplates());
      if (!this.isCurrentScope(read.scope) || this.archiveRead !== read) return;
      for (const mutation of read.mutations) templates = mutation(templates);
      this.values = templates; this.loaded = true; this.notify();
    } catch (error) { if (this.isCurrentScope(read.scope)) throw error; }
    finally { if (this.archiveRead === read) this.archiveRead = null; }
  }
  async upsert(template: CalculateOrderTemplate): Promise<CalculateOrderTemplate> {
    const scope = this.captureScope(), saved = await this.client.upsertTemplate(template);
    if (this.isCurrentScope(scope)) this.rememberCurrent(saved);
    return saved;
  }
  remember(template: CalculateOrderTemplate, { scope = this.captureScope() }: { scope?: CalculateOrderTemplateStoreScope } = {}): void {
    if (this.isCurrentScope(scope)) this.rememberCurrent(template);
  }
  private rememberCurrent(template: CalculateOrderTemplate) {
    const apply: Mutation = templates => dedupeCalculateOrderTemplates([template, ...templates.filter(item => item.id !== template.id)]);
    this.values = apply(this.values); this.archiveRead?.mutations.push(apply); this.notify();
  }
  async delete(id: string): Promise<void> {
    const scope = this.captureScope(); await this.client.deleteTemplate(id);
    if (!this.isCurrentScope(scope)) return;
    const apply: Mutation = templates => Object.freeze(templates.filter(template => template.id !== id));
    this.values = apply(this.values); this.archiveRead?.mutations.push(apply); this.notify();
  }
  private synchronizeScope(): string { const next = this.readScope(); if (this.scope !== next) this.clear(next); return next; }
  private clear(scope: string) { this.scope = scope; this.generation++; this.archiveRead = null; this.values = Object.freeze([]); this.loaded = false; }
  reset(): void { this.clear(this.readScope()); this.notify(); }
  async debugReset(): Promise<void> { this.reset(); }
  dispose(): void { this.disposed = true; this.generation++; this.archiveRead = null; this.listeners.clear(); }
}
