import { useState } from 'react';
import { View } from 'react-native';
import type { Session } from '../auth';
import { WorkerBottomBar } from './WorkerBottomBar';
import { WorkerPaddonList } from './WorkerPaddonList';
import { WorkerPaddonDetail } from './WorkerPaddonDetail';
import { WorkerPaddonTransfer } from './WorkerPaddonTransfer';

export function WorkerPaddons({ session, apparatus = '', name = '', onBack, onSelect }: { session: Session; apparatus?: string; name?: string; onBack(): void; onSelect?: (id: string) => void }) {
  const [page, setPage] = useState<{ kind: 'list' } | { kind: 'detail'; code: string; apparatus: string } | { kind: 'transfer'; apparatus: string }>({ kind: 'list' });
  const list = () => setPage({ kind: 'list' });
  return <>
      <View style={{ flex: 1, display: page.kind === 'list' ? 'flex' : 'none' }}><WorkerPaddonList session={session} apparatus={apparatus} name={name} visible={page.kind === 'list'} onBack={onBack} onProfile={onSelect ? () => onSelect('profile') : undefined}
        onDetail={(code, apparatus) => setPage({ kind: 'detail', code, apparatus })} onTransfer={apparatus => setPage({ kind: 'transfer', apparatus })} />
        {onSelect ? <WorkerBottomBar active="" onSelect={onSelect} onScan={() => {}} /> : null}
      </View>
      {page.kind === 'detail' ? <WorkerPaddonDetail session={session} code={page.code} apparatus={page.apparatus} onBack={list} />
        : page.kind === 'transfer' ? <WorkerPaddonTransfer session={session} apparatus={page.apparatus} onBack={list} /> : null}
    </>;
}
