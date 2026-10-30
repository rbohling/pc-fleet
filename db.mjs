import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
export async function database() {
  if (process.env.SQL_CONNECTION_STRING) {
    const sql = (await import('mssql')).default;
    const pool = await sql.connect(process.env.SQL_CONNECTION_STRING);
    return {
      async read() { const r = await pool.request().query('SELECT payload FROM dbo.FleetState WHERE id=1'); return r.recordset.length ? JSON.parse(r.recordset[0].payload) : {assets:[],events:[],revision:0}; },
      async write(state, revision) {
        const r = await pool.request().input('payload',sql.NVarChar(sql.MAX),JSON.stringify(state)).input('revision',sql.Int,revision).query('UPDATE dbo.FleetState SET payload=@payload, revision=revision+1 WHERE id=1 AND revision=@revision');
        if (r.rowsAffected[0] !== 1) throw Object.assign(new Error('Inventory changed. Refresh and try again.'),{status:409});
      },
      close:()=>pool.close()
    };
  }
  if (process.env.NODE_ENV === 'production') throw new Error('Production requires SQL_CONNECTION_STRING');
  const { DatabaseSync } = await import('node:sqlite');
  const file=process.env.DATA_FILE || 'data/fleet.sqlite'; mkdirSync(dirname(file),{recursive:true});
  const db=new DatabaseSync(file);
  db.exec('CREATE TABLE IF NOT EXISTS state (id INTEGER PRIMARY KEY, payload TEXT NOT NULL, revision INTEGER NOT NULL);');
  db.prepare('INSERT OR IGNORE INTO state VALUES (1, ?, 0)').run(JSON.stringify({assets:[],events:[],revision:0}));
  return {read:async()=>JSON.parse(db.prepare('SELECT payload FROM state WHERE id=1').get().payload),write:async(s,r)=>{if(db.prepare('UPDATE state SET payload=?,revision=revision+1 WHERE id=1 AND revision=?').run(JSON.stringify(s),r).changes!==1)throw Object.assign(new Error('Inventory changed. Refresh and try again.'),{status:409});},close:async()=>db.close()};
}
