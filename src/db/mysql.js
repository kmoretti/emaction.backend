import mysql from 'mysql2/promise';

export class MysqlRepository {
	constructor(pool) {
		this.driver = 'mysql';
		this.pool = pool;
	}

	static async create(config) {
		const pool = mysql.createPool({
			host: config.mysql.host,
			port: config.mysql.port,
			database: config.mysql.database,
			user: config.mysql.user,
			password: config.mysql.password,
			waitForConnections: true,
			connectionLimit: config.mysql.connectionLimit,
			connectTimeout: config.mysql.connectTimeout,
		});
		const repository = new MysqlRepository(pool);
		try {
			await repository.pool.query('select 1');
			return repository;
		} catch (error) {
			await repository.pool.end().catch(() => {});
			throw error;
		}
	}

	async getReactions(targetId) {
		const [rows] = await this.pool.execute(
			'select reaction_name, count from reactions where target_id = ? order by reaction_name',
			[targetId],
		);
		return rows;
	}

	async applyDelta(targetId, reactionName, diff) {
		const now = Date.now();
		await this.pool.execute(
			`insert into reactions (target_id, reaction_name, count, created_at, updated_at)
			 values (?, ?, greatest(0, ?), ?, ?)
			 on duplicate key update
			 count = greatest(0, cast(count as signed) + cast(? as signed)),
			 updated_at = ?`,
			[targetId, reactionName, diff, now, now, diff, now],
		);
	}

	async healthCheck() {
		await this.pool.query('select 1');
		await this.pool.query('select 1 from reactions limit 1');
		return true;
	}

	async close() {
		await this.pool.end();
	}
}

export async function initializeMysqlDatabase(config, schema) {
	const repository = await MysqlRepository.create(config);
	try {
		await repository.pool.query(schema);
	} finally {
		await repository.close();
	}
}
