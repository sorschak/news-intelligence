/**
 * Seed the outlet registry (SPEC.md Section 11). Idempotent.
 *
 *   npm run seed
 */

import { closeSql } from "../lib/db.js";
import { OUTLETS, seedOutlets } from "../lib/registry.js";

const added = await seedOutlets();
console.log(`Seeded outlets: ${added} added (${OUTLETS.length} in registry).`);
await closeSql();
