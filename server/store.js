import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { createHash, randomBytes, randomUUID, scryptSync, timingSafeEqual } from 'node:crypto';
import { freshState } from '../src/state.js';

export const dataPath = () => path.resolve(process.env.GAME_DATA_DIR || '.data', 'linh-thu.sqlite');
export const hashToken = token => createHash('sha256').update(token).digest('hex');
export function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  return `${salt}:${scryptSync(password, salt, 64).toString('hex')}`;
}
export function verifyPassword(password, stored) {
  const [salt, hex] = stored.split(':');
  const expected = Buffer.from(hex, 'hex'), actual = scryptSync(password, salt, 64);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
export class Store {
  constructor(filename = dataPath()) {
    if (filename !== ':memory:') mkdirSync(path.dirname(filename), { recursive: true, mode: 0o700 });
    this.db = new DatabaseSync(filename);
    this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY, username TEXT UNIQUE NOT NULL, display_name TEXT NOT NULL,
        password_hash TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'player',
        banned INTEGER NOT NULL DEFAULT 0, profile TEXT NOT NULL,
        created_at INTEGER NOT NULL, last_seen INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS sessions (
        token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        expires_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS audit (
        id INTEGER PRIMARY KEY AUTOINCREMENT, actor TEXT NOT NULL,
        target TEXT NOT NULL, action TEXT NOT NULL, detail TEXT NOT NULL, at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS sessions_user ON sessions(user_id);`);
  }
  close() { this.db.close(); }
  transaction(fn) {
    this.db.exec('BEGIN IMMEDIATE');
    try { const value = fn(); this.db.exec('COMMIT'); return value; }
    catch (error) { this.db.exec('ROLLBACK'); throw error; }
  }
  user(id) { return this.db.prepare('SELECT * FROM users WHERE id=?').get(id); }
  byUsername(name) { return this.db.prepare('SELECT * FROM users WHERE username=?').get(name); }
  createUser(username, displayName, password) {
    const id = randomUUID(), now = Date.now();
    this.db.prepare('INSERT INTO users(id,username,display_name,password_hash,profile,created_at,last_seen) VALUES(?,?,?,?,?,?,?)')
      .run(id, username, displayName, hashPassword(password), JSON.stringify(freshState()), now, now);
    return this.user(id);
  }
  publicUser(row) { return { id: row.id, username: row.username, displayName: row.display_name, role: row.role, banned: !!row.banned, createdAt: row.created_at, lastSeen: row.last_seen }; }
  account(row) { return { user: this.publicUser(row), profile: JSON.parse(row.profile) }; }
  saveProfile(id, profile) { this.db.prepare('UPDATE users SET profile=? WHERE id=?').run(JSON.stringify(profile), id); }
  newSession(id) {
    const token = randomBytes(32).toString('hex');
    this.db.prepare('DELETE FROM sessions WHERE expires_at<?').run(Date.now());
    this.db.prepare('INSERT INTO sessions VALUES(?,?,?)').run(hashToken(token), id, Date.now() + 7 * 86400_000);
    return token;
  }
  session(token) {
    if (!token) return null;
    return this.db.prepare('SELECT users.* FROM sessions JOIN users ON users.id=sessions.user_id WHERE token_hash=? AND expires_at>?').get(hashToken(token), Date.now());
  }
  revokeSessions(id) { this.db.prepare('DELETE FROM sessions WHERE user_id=?').run(id); }
  audit(actor, target, action, detail) { this.db.prepare('INSERT INTO audit(actor,target,action,detail,at) VALUES(?,?,?,?,?)').run(actor, target, action, detail, Date.now()); }
  grantAdmin(username) {
    const user = this.byUsername(username);
    if (!user) throw new Error('Tài khoản chưa tồn tại. Hãy đăng ký trong game trước.');
    if (user.banned) throw new Error('Tài khoản đang bị khóa.');
    this.db.prepare("UPDATE users SET role='admin' WHERE id=?").run(user.id);
    this.audit('server-owner', user.id, 'role', `Cấp quyền quản trị cho ${username}`);
    return this.publicUser(this.user(user.id));
  }
}
