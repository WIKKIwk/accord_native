import type { Session } from '../auth';
import { authorizedFetch } from '../authorizedFetch';
import type { CustomerDirectoryEntry } from './werkaArchiveBatchQr';

type Obj = Record<string, unknown>;
type DirectoryOptions = { query?: string; limit?: number; offset?: number };
export type SupplierDirectoryEntry = CustomerDirectoryEntry;
const object = (value: unknown): Obj => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('Invalid directory entry');
  return value as Obj;
};
const string = (value: unknown): string => {
  if (value == null) return '';
  if (typeof value !== 'string') throw new TypeError('Invalid directory string');
  return value;
};
/** @v2 SupplierDirectoryEntry */
/** @v2 CustomerDirectoryEntry */
function directoryEntry(value: unknown): CustomerDirectoryEntry {
  const row = object(value);
  return { ref: string(row.ref), name: string(row.name), phone: string(row.phone) };
}
function directoryPath(path: string, options: DirectoryOptions): string {
  const query = new URLSearchParams(), limit = options.limit ?? 200, offset = options.offset ?? 0;
  if (options.query?.trim()) query.set('q', options.query.trim());
  if (limit > 0) query.set('limit', String(limit));
  if (offset > 0) query.set('offset', String(offset));
  const suffix = query.toString();
  return suffix ? `${path}?${suffix}` : path;
}
async function entries(response: Response, error: string): Promise<CustomerDirectoryEntry[]> {
  if (response.status !== 200) throw new Error(error);
  const data: unknown = await response.json();
  if (!Array.isArray(data)) throw new TypeError('Invalid directory list');
  return data.map(directoryEntry);
}

/** @v2 werkaSuppliers */
export async function werkaSuppliers(session: Session, options: DirectoryOptions = {}): Promise<SupplierDirectoryEntry[]> {
  return entries(await authorizedFetch(session, directoryPath('/v1/mobile/werka/suppliers', options)), 'Werka suppliers failed');
}

/** @v2 werkaCustomers */
export async function werkaCustomers(session: Session, options: DirectoryOptions = {}): Promise<CustomerDirectoryEntry[]> {
  return entries(await authorizedFetch(session, directoryPath('/v1/mobile/werka/customers', options)), 'Werka customers failed');
}
