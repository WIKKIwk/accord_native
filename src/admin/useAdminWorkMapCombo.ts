import { useState } from 'react';
/** V2 keeps the embedded content mounted while collapsed; it contains no independent state or requests. */
export function useAdminWorkMapCombo() {
  const [expanded, setExpanded] = useState(false);
  return { expanded, toggle: () => setExpanded(value => !value) };
}
