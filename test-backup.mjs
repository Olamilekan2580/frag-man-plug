import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
const root=mkdtempSync(join(tmpdir(),'vega-backup-')),data=join(root,'source'),target=join(root,'snapshot');
try{
  mkdirSync(join(data,'uploads'),{recursive:true});writeFileSync(join(data,'uploads','test.webp'),'fixture');
  const db=new DatabaseSync(join(data,'store.sqlite'));db.exec("PRAGMA journal_mode=WAL; CREATE TABLE records(id TEXT PRIMARY KEY); INSERT INTO records VALUES('paid-order');");
  const result=spawnSync(process.execPath,['backup.mjs',target],{env:{...process.env,DATA_DIR:data},encoding:'utf8'});assert.equal(result.status,0,result.stderr);
  const copy=new DatabaseSync(join(target,'store.sqlite'),{readOnly:true});assert.equal(copy.prepare('SELECT id FROM records').get().id,'paid-order');assert.equal(copy.prepare('PRAGMA integrity_check').get().integrity_check,'ok');copy.close();
  assert.equal(readFileSync(join(target,'uploads','test.webp'),'utf8'),'fixture');
  const overwrite=spawnSync(process.execPath,['backup.mjs',target],{env:{...process.env,DATA_DIR:data},encoding:'utf8'});assert.notEqual(overwrite.status,0);db.close();
  console.log('PASS: consistent WAL database backup, integrity check, uploaded files and overwrite protection.');
}finally{rmSync(root,{recursive:true,force:true});}
