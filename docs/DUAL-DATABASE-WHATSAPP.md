# LexisPredict — two databases, balanced WhatsApp writes (opt-in)

## Scope
- **Primary Supabase:** authentication, companies, users, roles, legal cases, DJEN and all current business tables.
- **Secondary Supabase:** a second independent PostgreSQL/Supabase project for approximately half of new WhatsApp history and operational telemetry (`scan_metrics`, `alert_events`).
- **Write placement:** stable FNV-1a hash over the final eight phone digits, approximately 50/50 **by distinct phone numbers** across both databases (not guaranteed equal message counts, disk bytes, query time or CPU).
- **Read placement:** history searches both databases **in parallel**, merges by message ID and timestamp, returning partial data plus an explicit warning if a shard fails. Writes NEVER retry on the other shard, preventing silent divergence.
- **Storage:** each new message is written to exactly one database. When sharding is active, provider raw JSON (often very large) is off by default. Enable `LEXIS_WA_STORE_RAW=true` only if required.
- **Compatibility:** current databases, auth and legal processes remain unchanged with the default `LEXIS_DUAL_DB_MODE=primary`. Existing primary WhatsApp history remains readable in dual mode.

## Deploy procedure
1. Back up both databases, confirm tenant isolation and keep a rollback plan. Rotate any secrets that were pasted into conversations or tickets.
2. Create a **separate** Supabase project; use SQL from `docs/sql/lexis-secondary-whatsapp.sql` in its SQL editor. Verify server-only access and RLS.
3. Set **server-only Vercel environment variables** (do not use `NEXT_PUBLIC_` for service keys):
   - `LEXIS_SECONDARY_SUPABASE_URL` = URL of new project
   - `LEXIS_SECONDARY_SUPABASE_SERVICE_ROLE_KEY` = secondary service-role key
   - `LEXIS_DUAL_DB_MODE=sharded` to activate **after** schema and verification
   - Optional `LEXIS_WA_STORE_RAW=false` (default in dual mode)
4. Redeploy Preview first; test an existing contact and two new contacts with different shard assignments. Use superadmin `getDualDbHealthAction` to compare message rows and response times.
5. Enable Production only after testing. Restore `LEXIS_DUAL_DB_MODE=primary` to stop new secondary writes during rollback, **but historical secondary messages still need retrieval/migration** before ending dual reads.
6. Historical data is **not migrated or deleted automatically**. Export, verify, then migrate rows using a separate audited script with idempotency before reducing storage in primary.

## Limitations and required follow-up
- This branch also shards **new** `scan_metrics` and `alert_events` rows by per-event UUID hash. It does not move existing rows or split `processos` or legally significant `auditoria_logs_app`; those remain entirely on the original Supabase. This is not a 50/50 split of the whole application.
- Exact 50/50 load is impossible with deterministic hashing alone: one active contact may generate thousands of messages. Observe per-shard CPU, IO, bytes, p95 latency, and active connections before expanding.
- Main dashboard performance still requires query plans and targeted pagination; duplicating an entire DB for read balancing would **increase** storage and costs.
- Webhook records without `empresa_id` need a trusted Evolution-instance→tenant mapping before sharing access across tenants. Historical deletion is intentionally tenant-scoped; null-tenant legacy entries require controlled admin cleanup.
- A second Supabase project can increase total subscription/compute costs; compare plan limits before provisioning.
- Never configure both URLs to the same Supabase project; the router rejects it.

## Real W1CAPITAL database sizing and rollout (2026-10-08)
The original W1 Supabase has roughly 55 MB in `auditoria_logs_app`, 29 MB in `processos`, 19 MB in `scan_metrics`, 18 MB in `alert_events`, but **zero rows** in `whatsapp_messages`. Thus WhatsApp-only sharding does not save meaningful space now. Event-per-row telemetry routing is chosen over stable-by-protocol routing to distribute frequent scanner writes across both services.

Two independent databases can **increase total price and connections**. Parallel reads improve completeness and may reduce wall-clock time, but **cannot guarantee equal CPU, disk or latency**. This design performs no automatic cross-shard data migrations, deletions, replication or split of legal-case transactions. Older telemetry stays on primary until an independently reviewed, idempotent migration.

**Do not enable** `LEXIS_DUAL_DB_MODE=sharded` before W1 confirms the second Supabase organization/project, deploys the schema, configures service-only credentials, validates tenant isolation and measures reads/writes in Preview. Never use W2CAPITAL API keys or projects as the second W1 database.

## Access control hardening
- A trusted W1 `LEXIS_WEBHOOK_EMPRESA_ID` (or existing W1 `LEXIS_HYBRID_EMPRESA_ID`) must map Evolution webhook traffic to the correct W1 tenant. Never accept `payload.empresa_id` from a webhook as authority.
- All history reads are scoped to the authenticated tenant even though shard clients use server-side service-role keys.
- New WhatsApp history rows require `empresa_id`, including fallback inserts. The secondary schema makes it mandatory. Missing tenant mapping is an explicit failure, not a cross-tenant default.
- No secondary credentials may be exposed to client bundles or `NEXT_PUBLIC_*` settings.
