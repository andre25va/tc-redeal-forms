/**
 * @deprecated APP18 — This file has been migrated to Supabase.
 * All 47 rules (6 boards, 14 forms, 33 conditional triggers) now live in:
 *   compliance_rules table (mls_board IS NOT NULL)
 *
 * Read via: GET /api/compliance/library
 * Returned shape: MlsBoard[] — identical to what MLS_LIBRARY exported
 *
 * This file is kept temporarily to avoid breaking any remaining build
 * references. Remove in the next cleanup PR once confirmed.
 *
 * DO NOT add new rules here. Add rows to compliance_rules in Supabase.
 */

export const MLS_LIBRARY: never[] = [];
