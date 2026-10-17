# VEGArance — Durable Storage & Production DB Path (Phase B, P0)

## The honest current state

- The app stores everything in SQLite (`store.sqlite` in `DATA_DIR`,
  default `./data`) plus uploaded files in `DATA_DIR/uploads`.
- On **free Render** the filesystem is ephemeral: restarts and redeploys
  wipe SQLite + uploads. `describeStorage()` reports `durable: false`
  and a plain warning; the activation check "Persistent platform storage"
  fails; `/api/health` reports the same.
- `DURABLE_STORAGE_CONFIRMED=true` is the owner's attestation that
  `DATA_DIR` points at a persistent volume — it is not itself proof.
  Setting it on an ephemeral filesystem would be a lie; do not set it
  unless the disk/volume is actually provisioned.

## Option A — Paid Render disk (recommended first step; already blueprinted)

- `render.production.yaml` provisions a Render web service (starter plan)
  with a 1 GB persistent disk mounted at `/var/data`, `DATA_DIR=/var/data`,
  `DURABLE_STORAGE_CONFIRMED=true`.
- Pros: smallest change — same SQLite code, same backup script, no
  migration, no new service to learn. Uploads persist with the DB.
- Cons: disk is tied to one Render service/instance (no multi-instance
  scaling); SQLite is single-writer; disk size must be grown manually.
- Cost: paid Render plan + disk — check Render's current pricing before
  committing; this repo states no price.
- Verification after provisioning: deploy, create a test record, restart
  the service, confirm the record survives; run `npm run backup` +
  `npm run backup:verify` and confirm the backup verifies.

## Option B — Hosted Postgres (Supabase / Neon / Render Postgres)

- Move the database to managed Postgres; keep uploads on a persistent
  disk or object storage (Postgres does not store uploads).
- Pros: survives restarts independently of the web service; concurrent
  writers; managed backups / point-in-time recovery; scales beyond one
  instance.
- Cons: a real migration — every `node:sqlite` query must be ported
  (parameter placeholders, `json_extract`, `PRAGMA`, `VACUUM INTO`,
  `ON CONFLICT` dialects all differ), plus a Postgres client + connection
  pooling, plus an uploads story (disk or S3-compatible object storage).
  Managed Postgres is a recurring cost; free tiers have row/connection
  limits that must be checked against real usage.
- `DATABASE_URL` status: **recognised but NOT WIRED.** If set, the server
  still uses SQLite and reports `database.status:
  'recognised_not_wired'` in health output. Setting `DATABASE_URL` alone
  changes nothing — do not set it expecting Postgres until the migration
  lands.

## Option C — SQLite on a durable volume elsewhere (Turso / libSQL, VPS disk)

- Keep SQLite semantics with a durable home: a VPS with a real disk, or
  a hosted SQLite service (e.g. Turso/libSQL) with replication.
- Pros: closest to today's code if the driver stays SQLite-compatible.
- Cons: Turso changes the driver (HTTP client, auth tokens, embedded
  replicas); a VPS reintroduces server ops (backups, patching,
  monitoring) that Render currently handles.

## Migration path (when the owner picks Option B)

1. Freeze a schema inventory: every `CREATE TABLE` in the codebase
   (owner store, merchants, stores, products, connections, billing,
   sales, orders, quotes, API keys, webhooks, email jobs, inventory).
2. Write a Postgres schema with the same tables; map SQLite types
   (`TEXT` JSON documents stay `JSONB`; `INTEGER` timestamps stay
   `BIGINT`; `ON CONFLICT` targets stay explicit).
3. Build a one-off exporter: dump each SQLite table to newline-delimited
   JSON, then a loader that inserts into Postgres in dependency order
   (merchants → stores → products/connections/billing → orders).
4. Dual-run in staging: run the Postgres build against a copy of
   production data; run the full test suite with a Postgres test
   database; verify login, checkout, webhooks, and billing gates.
5. Cut over with a maintenance window: stop writes, export, load,
   verify row counts + integrity, switch `DATABASE_URL`, restart,
   smoke-test. Keep the SQLite file as the rollback snapshot.
6. Never run the two databases in production simultaneously as sources
   of truth — one cutover, one rollback file.

## Backups (implemented, verified)

- `npm run backup` — `VACUUM INTO` snapshot of SQLite + copy of uploads
  into a timestamped directory (mode `0700`).
- `npm run backup:verify -- <backup-dir>` — opens the snapshot
  read-only, requires `PRAGMA integrity_check = 'ok'`, requires the core
  tables (`products`, `settings`, `orders`), reports row counts and
  whether uploads are present. Exit non-zero on any failure.
- A backup that does not verify is not a backup. Verify every backup
  before trusting it; verify after any restore drill.
- Backups still live on the same filesystem unless the owner copies
  them off the server (object storage / download). Off-server copies
  are the owner's job until automated backup shipping is built.

## What the owner must decide

1. **Durable storage now:** provision the paid Render disk
   (`render.production.yaml`) — or accept that nothing on free Render
   survives a restart. Do not launch on free Render.
2. **Postgres later:** whether/when to migrate (Option B). The decision
   can wait until the platform has real merchants and real order volume;
   the disk (Option A) is the correct first step either way.
