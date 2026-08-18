import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const __dirname=path.dirname(fileURLToPath(import.meta.url));
const db=new pg.Pool({connectionString:process.env.DATABASE_URL??'postgres://ai_tax:ai_tax_dev@localhost:5432/ai_tax'});
await db.query(`CREATE TABLE IF NOT EXISTS schema_migrations(version TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())`);
const files=(await readdir(path.join(__dirname,'..','db'))).filter(f=>/^\d+.*\.sql$/.test(f)).sort();
for(const file of files){const version=file.split('-')[0];const exists=await db.query('SELECT 1 FROM schema_migrations WHERE version=$1',[version]);if(exists.rowCount)continue;console.log('Applying',file);const sql=await readFile(path.join(__dirname,'..','db',file),'utf8');const client=await db.connect();try{await client.query('BEGIN');await client.query(sql);await client.query('INSERT INTO schema_migrations(version) VALUES($1)',[version]);await client.query('COMMIT');}catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();}}
console.log('Database migrations complete.');await db.end();
