import {DatabaseSync} from 'node:sqlite';
import {mkdirSync,cpSync,existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('.',import.meta.url));
const data=resolve(process.env.DATA_DIR||resolve(root,'data'));
const target=resolve(process.argv[2]||resolve(data,'backups',new Date().toISOString().replace(/[:.]/g,'-')));
if(target===data||data.startsWith(target+'/'))throw new Error('Choose a separate backup directory');
if(existsSync(target))throw new Error('Backup destination already exists');
mkdirSync(target,{recursive:true,mode:0o700});
const db=new DatabaseSync(resolve(data,'store.sqlite'),{readOnly:true});
try{
  // VACUUM INTO creates a consistent SQLite snapshot, including WAL changes.
  db.exec("VACUUM INTO '"+resolve(target,'store.sqlite').replace(/'/g,"''")+"'");
  if(existsSync(resolve(data,'uploads')))cpSync(resolve(data,'uploads'),resolve(target,'uploads'),{recursive:true});
  console.log('Database and uploads backed up to '+target);
}finally{db.close();}
