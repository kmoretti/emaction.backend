async function createSqlite(config) {
	const { SqliteRepository } = await import('./sqlite.js');
	return SqliteRepository.create(config);
}

async function createMysql(config) {
	const { MysqlRepository } = await import('./mysql.js');
	return MysqlRepository.create(config);
}

export async function createRepository(config, logger = console) {
	if (config.driver === 'sqlite') {
		return {
			repository: await createSqlite(config),
			database: 'sqlite',
			mode: 'primary',
			degraded: false,
		};
	}

	try {
		return {
			repository: await createMysql(config),
			database: 'mysql',
			mode: 'primary',
			degraded: false,
		};
	} catch (error) {
		if (config.driver !== 'auto') throw error;
		logger.warn(`MySQL unavailable; using SQLite fallback: ${error.message}`);
		return {
			repository: await createSqlite(config),
			database: 'sqlite',
			mode: 'fallback',
			degraded: true,
		};
	}
}
