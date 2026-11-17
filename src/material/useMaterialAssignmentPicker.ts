import { useEffect, useState } from 'react';
import type { AssignmentOrder } from './materialAssignmentsController';
import { materialAssignmentPickerRows } from './materialAssignmentPicker';

export function useMaterialAssignmentPicker(orders: readonly AssignmentOrder[], label: (order: AssignmentOrder) => string) {
  const [input, setInput] = useState(''), [query, setQuery] = useState(''), [limit, setLimit] = useState(50);
  useEffect(() => { const timer = setTimeout(() => { setQuery(input); setLimit(50); }, 220); return () => clearTimeout(timer); }, [input]);
  const result = materialAssignmentPickerRows(orders, query, label, limit);
  return { ...result, input, setInput, loadMore: () => { if (result.hasMore) setLimit(value => value + 50); } };
}
