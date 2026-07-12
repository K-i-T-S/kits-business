import { PowerSyncDatabase } from '@powersync/web';

import { AppSchema } from './AppSchema';
import { SupabaseConnector } from './connector';

/**
 * Track: offline-first architecture, Phase 1b
 * (docs/superpowers/specs/2026-07-11-platform-roadmap-design.md).
 *
 * Created once at module scope, not inside a component/useEffect -- React
 * Strict Mode's dev-mode double-mount would otherwise close the shared
 * sync worker's DB proxy on the first mount's cleanup before the second
 * mount can use it, silently breaking the connection (a documented
 * PowerSync + React pitfall).
 *
 * connect() is fire-and-forget and safe to call before a Supabase session
 * exists (e.g. on the Login page) -- fetchCredentials() will simply fail
 * and PowerSync retries in the background until a session is available,
 * the same pattern AppContext/SubscriptionContext already use for their
 * own onAuthStateChange-driven initialization.
 */
export const powerSyncDb = new PowerSyncDatabase({
  schema: AppSchema,
  database: { dbFilename: 'kits-powersync.db' },
});

const connector = new SupabaseConnector();
void powerSyncDb.connect(connector);
