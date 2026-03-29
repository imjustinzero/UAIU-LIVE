import Database from 'better-sqlite3';
const db = new Database('gateway-buffer.db');
db.exec('create table if not exists readings(id integer primary key autoincrement, payload text not null, created_at text default CURRENT_TIMESTAMP)');

export function queueReading(payload: any) {
  db.prepare('insert into readings(payload) values (?)').run(JSON.stringify(payload));
}

export function takeBatch(limit = 100) {
  const rows = db.prepare('select id,payload from readings order by id asc limit ?').all(limit) as any[];
  return rows.map((r) => ({ id: r.id, payload: JSON.parse(r.payload) }));
}

export function ackBatch(ids: number[]) {
  if (!ids.length) return;
  const q = ids.map(() => '?').join(',');
  db.prepare(`delete from readings where id in (${q})`).run(...ids);
}

export function bufferDepth() {
  return (db.prepare('select count(*) as c from readings').get() as any).c as number;
}
