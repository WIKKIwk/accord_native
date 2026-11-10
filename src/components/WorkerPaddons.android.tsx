import { useState } from 'react';
import type { Session } from '../auth';
import { WorkerPaddonList } from './WorkerPaddonList';
import { WorkerPaddonDetail } from './WorkerPaddonDetail';
import { WorkerPaddonTransfer } from './WorkerPaddonTransfer';

export function WorkerPaddons({ session, apparatus = '', name = '', onBack }: { session: Session; apparatus?: string; name?: string; onBack(): void }) {
  const [page, setPage] = useState<{ kind: 'list' } | { kind: 'detail'; code: string; apparatus: string } | { kind: 'transfer'; apparatus: string }>({ kind: 'list' });
  const list = () => setPage({ kind: 'list' });
  return page.kind === 'detail' ? <WorkerPaddonDetail session={session} code={page.code} apparatus={page.apparatus} onBack={list} />
    : page.kind === 'transfer' ? <WorkerPaddonTransfer session={session} apparatus={page.apparatus} onBack={list} />
      : <WorkerPaddonList session={session} apparatus={apparatus} name={name} onBack={onBack}
        onDetail={(code, apparatus) => setPage({ kind: 'detail', code, apparatus })} onTransfer={apparatus => setPage({ kind: 'transfer', apparatus })} />;
}
