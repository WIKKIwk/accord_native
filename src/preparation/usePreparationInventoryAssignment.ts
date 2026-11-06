import { useCallback, useEffect, useRef, useState } from 'react';
import { activeSessionToken, registerSessionResetHook, type Session } from '../auth';
import { adminApparatus } from '../apparatusApi';
import { adminRawMaterialLookup, adminUnlinkRawMaterialAssignment, preparationAssignMaterial, preparationAssignmentCandidates } from './preparationInventoryAssignment';

type Lookup = Awaited<ReturnType<typeof adminRawMaterialLookup>>;
type Candidate = Awaited<ReturnType<typeof preparationAssignmentCandidates>>[number];
export function usePreparationInventoryAssignment(session: Session, barcode: string, allow: boolean, changed: () => Promise<void>) {
  const [lookup, setLookup] = useState<Lookup | null>(null), [candidates, setCandidates] = useState<Candidate[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true), [saving, setSaving] = useState(false), [error, setError] = useState('');
  const valid = useRef(true), generation = useRef(0);
  const current = () => valid.current && !!activeSessionToken(session);
  const load = useCallback(async () => {
    const id = ++generation.current;
    if (!current()) return;
    setLoading(true); setError(''); setLookup(null); setCandidates([]);
    try {
      const value = await adminRawMaterialLookup(session, barcode);
      if (!current() || id !== generation.current) return;
      setLookup(value);
      if (!value.assignment && allow) {
        const results = await preparationAssignmentCandidates(session, barcode);
        if (!current() || id !== generation.current) return;
        setCandidates(results);
      }
      if (value.assignment || allow) {
        void adminApparatus(session, { limit: 10000, retryTransient: true }).then(items => {
          if (current() && id === generation.current) setNames(Object.fromEntries(items.map(item => [item.id, item.name])));
        }).catch(() => {});
      }
    } catch (reason) { if (current() && id === generation.current) setError(reason instanceof Error ? reason.message : String(reason)); }
    finally { if (current() && id === generation.current) setLoading(false); }
  // Session and barcode define the scoped read.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, barcode, allow]);
  useEffect(() => {
    let active = true;
    valid.current = true;
    const currentGeneration = generation;
    const unregister = registerSessionResetHook(async () => { valid.current = false; currentGeneration.current++; setLookup(null); setCandidates([]); });
    void Promise.resolve().then(() => { if (active) void load(); });
    return () => { active = false; valid.current = false; currentGeneration.current++; unregister(); };
  }, [load]);
  const assign = async (candidate: Candidate, apparatus: string) => {
    if (!allow || saving || !current()) return;
    setSaving(true);
    try { await preparationAssignMaterial(session, candidate.order.map.id, barcode, apparatus); if (current()) { await load(); await changed(); } }
    finally { if (current()) setSaving(false); }
  };
  const unlink = async () => {
    if (!lookup?.assignment || saving || !current()) return;
    setSaving(true);
    try { await adminUnlinkRawMaterialAssignment(session, lookup.assignment.order_id, barcode); if (current()) { await load(); await changed(); } }
    finally { if (current()) setSaving(false); }
  };
  return { lookup, candidates, names, loading, saving, error, load, assign, unlink };
}
