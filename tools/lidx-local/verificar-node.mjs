import { DatabaseSync } from 'node:sqlite';
const db = new DatabaseSync(':memory:');
const s = db.prepare('SELECT 1'); s.setReadBigInts(true); [...s.iterate()]; db.close();
