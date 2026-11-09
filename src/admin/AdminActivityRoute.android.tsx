import { AdminActivityRoute as Route } from './AdminActivityRouteCore';
import { AdminBottomBar } from './AdminBottomBar.android';
export function AdminActivityRoute() { return <Route footer={<AdminBottomBar active="activity" />} />; }
