import type { Session } from '../auth';
import { sessionReadScope } from '../sessionReadScope';
import { MobileApiException } from '../shared/mobileApiException';
import { trimDart } from './qolipApiCommon';
import { filterQolipSearch, QolipSearchDocument } from './qolipSearchEngine';
import { searchRelevanceScore } from './qolipSearchRelevance';
import { qolipManagedSets, type QolipManagedSet } from './qolipSetsApi';

const setDocuments = new WeakMap<QolipManagedSet, QolipSearchDocument>();
const setNameDocuments = new WeakMap<QolipManagedSet, QolipSearchDocument>();
const compare = (left: string, right: string) => left === right ? 0 : left < right ? -1 : 1;

/** @v2 searchQolipSets */
export async function searchQolipSets(sets: Iterable<QolipManagedSet>, query: string, options: {
  includeMoldCodes?: boolean; isCurrent?: () => boolean;
} = {}): Promise<QolipManagedSet[]> {
  const includeMoldCodes = options.includeMoldCodes ?? true;
  const documents = includeMoldCodes ? setDocuments : setNameDocuments;
  function* nonempty() { for (const entry of sets) if (entry.set.members.length > 0) yield entry; }
  const matches = await filterQolipSearch(nonempty(), query, entry => {
    let document = documents.get(entry);
    if (!document) {
      document = new QolipSearchDocument([entry.name, entry.set.id,
        ...(includeMoldCodes ? entry.set.members.map(mold => mold.qolip_code) : [])]);
      documents.set(entry, document);
    }
    return document;
  }, { isCurrent: options.isCurrent });
  if (matches === null) return [];
  const needle = trimDart(query).toLowerCase();
  const score = (entry: QolipManagedSet) => {
    if (entry.set.id.toLowerCase() === needle ||
        (includeMoldCodes && entry.set.members.some(mold => mold.qolip_code.toLowerCase() === needle))) return 100000;
    if (entry.name.toLowerCase() === needle) return 90000;
    return searchRelevanceScore(query, entry.name,
      [entry.set.id, ...(includeMoldCodes ? entry.set.members.map(mold => mold.qolip_code) : [])]);
  };
  return matches.sort((a, b) => score(b) - score(a) ||
    compare(a.display_name.toLowerCase(), b.display_name.toLowerCase()) || compare(a.set.id, b.set.id));
}

/** @v2 QolipSetLookup */
export class QolipSetLookup {
  private scope: string | null = null;
  private future: Promise<QolipManagedSet[]> | null = null;
  constructor(private readonly session: Session) {}
  private get currentScope(): string { return `${this.session.baseUrl}|${sessionReadScope(this.session)}`; }
  get isCurrent(): boolean { return this.scope === this.currentScope; }

  load(refresh = false): Promise<QolipManagedSet[]> {
    const scope = this.currentScope;
    if (refresh || this.scope !== scope) { this.scope = scope; this.future = null; }
    return this.future ??= this.read(scope);
  }
  private async read(scope: string): Promise<QolipManagedSet[]> {
    try {
      const sets = await qolipManagedSets(this.session);
      if (scope !== this.currentScope) throw new MobileApiException({ code: 'session_scope_changed', message: 'session_scope_changed' });
      return sets;
    } catch (error) {
      if (this.scope === scope) this.future = null;
      throw error;
    }
  }
}
