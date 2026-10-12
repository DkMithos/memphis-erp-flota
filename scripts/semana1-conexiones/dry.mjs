// Runner usado en la semana 1 del plan de carga (2026-10-12). Requiere `pg` (npm i pg en una carpeta aparte, p. ej. el scratchpad).
// Variables: PGUSER=<rol_tmp> PGPASS=<clave> [PGROLE=<rol a asumir>]. Ejecuta el .sql completo (con su begin … rollback;) y muestra los SELECT.
// Ejecuta un script SQL completo (con su propio begin/rollback|commit) y muestra las filas de cada SELECT.
// Uso: node dry.mjs archivo.sql [--commit]  (--commit reemplaza el "rollback;" final por "commit;")
import pg from 'pg';
import fs from 'node:fs';
const [,, file, flag] = process.argv;
let sql = fs.readFileSync(file, 'utf8');
if (flag === '--commit') sql = sql.replace(/rollback;\s*$/i, 'commit;');
const c = new pg.Client({ host: 'aws-1-sa-east-1.pooler.supabase.com', port: 5432, user: `${process.env.PGUSER}.icmuqwgrjgjoebnwunnf`, password: process.env.PGPASS, database: 'postgres', ssl: { rejectUnauthorized: false } });
await c.connect();
try {
  if (process.env.PGROLE) await c.query('set role ' + process.env.PGROLE);
  const res = await c.query(sql);
  for (const r of Array.isArray(res) ? res : [res]) {
    if (r.command && r.command !== 'SELECT') console.log(`${r.command} ${r.rowCount ?? ''}`.trim());
    if (r.rows?.length) for (const row of r.rows) console.log(JSON.stringify(row));
  }
  console.log(flag === '--commit' ? '== COMMIT ==' : '== ROLLBACK (dry-run) ==');
} catch (e) {
  await c.query('rollback').catch(() => {});
  console.error('ERROR', e.message, e.position ? 'pos ' + e.position : '', e.where ?? '', e.detail ?? '');
  process.exitCode = 1;
} finally { await c.end(); }
