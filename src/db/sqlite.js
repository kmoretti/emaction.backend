import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';

export class SqliteRepository {
	constructor(config) {
		const directory = path.dirname(config.sqlite.path);
		if (directory && directory !== '.') fs.mkdirSync(directory, { recursive: true });

		this.driver = 'sqlite';
		this.db = new Database(config.sqlite.path);
		this.db.pragma(`busy_timeout = ${config.sqlite.busyTimeout}`);
		this.db.pragma('journal_mode = WAL');
		this.selectReactions = this.db.prepare(
			'select reaction_name, count from reactions where target_id = ? order by reaction_name',
		);
		this.incrementReaction = this.db.prepare(`
			insert into reactions (target_id, reaction_name, count, created_at, updated_at)
			values (?, ?, max(0, ?), ?, ?)
			on conflict (target_id, reaction_name) do update set
				count = max(0, reactions.count + ?),
				updated_at = ?
		`);
	}

	static async create(config) {
		return new SqliteRepository(config);
	}

	async getReactions(targetId) {
		return this.selectReactions.all(targetId);
	}

	async applyDelta(targetId, reactionName, diff) {
		const now = Date.now();
		this.incrementReaction.run(targetId, reactionName, diff, now, now, diff, now);
	}

	async healthCheck() {
		this.db.prepare('select 1').get();
		this.db.prepare('select 1 from reactions limit 1').get();
		return true;
	}

	async close() {
		this.db.close();
	}
}

export function initializeSqliteDatabase(config, schema) {
	const directory = path.dirname(config.sqlite.path);
	if (directory && directory !== '.') fs.mkdirSync(directory, { recursive: true });
	const db = new Database(config.sqlite.path);
	db.exec(schema);
	db.close();
}
