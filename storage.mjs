/* Vegarance v3 — durable storage description + backup verification (Phase B).
   TRUTHFUL BY DESIGN: this module describes storage; it does not pretend
   to provide durability the deployment does not have.
   - Default deployment (free Render, no disk): SQLite on the ephemeral
     filesystem. Data RESETS on restart/redeploy. `durable` is false and
     the readiness checks + health output say so plainly.
   - Durable: DURABLE_STORAGE_CONFIRMED=true AND DATA_DIR set — the
     owner's attestation that DATA_DIR points at a persistent disk
     (render.production.yaml) or other durable volume. The flag alone is
     not proof; the owner confirms it when they provision the disk.
   - DATABASE_URL: RECOGNISED BUT NOT WIRED. If set, we report it as
     recognised_not_wired and keep using SQLite. Setting DATABASE_URL
     alone does NOT switch the database — the Postgres migration in
     STORAGE.md is still to be built. Never claim otherwise. */

import {DatabaseSync} from 'node:sqlite';
import {existsSync, statSync} from 'node:fs';
import {resolve} from 'node:path';

export function describeStorage(env = process.env) {
  const dataDir = env.DATA_DIR || '';
  const durable = env.DURABLE_STORAGE_CONFIRMED === 'true' && !!dataDir;
  const databaseUrl = env.DATABASE_URL || '';
  const database = databaseUrl
    ? {
        configured: true,
        inUse: 'sqlite',
        requested: 'postgres',
        status: 'recognised_not_wired',
        note: 'DATABASE_URL is set, but no Postgres driver is implemented — the server still uses SQLite. See STORAGE.md for the migration path. Do not rely on DATABASE_URL until the migration lands.',
      }
    : {
        configured: false,
        inUse: 'sqlite',
        requested: null,
        status: 'sqlite_only',
        note: 'SQLite on DATA_DIR (or ./data by default). Durable only when DATA_DIR is a persistent disk and DURABLE_STORAGE_CONFIRMED=true.',
      };
  return {
    driver: 'sqlite',
    durable,
    dataDirConfigured: !!dataDir,
    ephemeral: !durable,
    database,
    backup: {
      command: 'npm run backup',
      verifyCommand: 'npm run backup:verify -- <backup-dir>',
      note: 'Backups are SQLite snapshots (VACUUM INTO) + uploads. Verify every backup with the verify command before trusting it.',
    },
    warning: durable
      ? null
      : 'Storage is NOT durable: on free Render the filesystem resets and SQLite + uploads are lost on restart/redeploy. Do not launch on this configuration — see STORAGE.md.',
  };
}

/* Verify a backup directory produced by `npm run backup`:
   integrity_check must return 'ok', and the core tables must exist.
   Throws on any failure; returns a summary on success. */
export function verifyBackupFile(backupDir) {
  const dbPath = resolve(backupDir, 'store.sqlite');
  if (!existsSync(dbPath)) throw new Error('Backup not found: no store.sqlite in ' + backupDir);
  const db = new DatabaseSync(dbPath, {readOnly: true});
  try {
    const integrity = db.prepare('PRAGMA integrity_check').get();
    if (!integrity || integrity.integrity_check !== 'ok')
      throw new Error('Backup failed integrity_check: ' + JSON.stringify(integrity));
    const tables = new Set(db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(r => r.name));
    const required = ['products', 'settings', 'orders'];
    const missing = required.filter(t => !tables.has(t));
    if (missing.length) throw new Error('Backup is missing required tables: ' + missing.join(', '));
    const counts = {};
    for (const table of ['products', 'orders']) {
      try { counts[table] = db.prepare(`SELECT COUNT(*) AS n FROM "${table}"`).get().n; }
      catch { counts[table] = null; }
    }
    const uploads = existsSync(resolve(backupDir, 'uploads'))
      ? statSync(resolve(backupDir, 'uploads')).isDirectory()
      : false;
    return {ok: true, backupDir, integrity: 'ok', tables: [...tables], counts, uploadsPresent: uploads};
  } finally {
    db.close();
  }
}
