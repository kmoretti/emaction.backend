const DEFAULT_PORT = 8080;
const DEFAULT_HOST = '0.0.0.0';

function parsePositiveInteger(value, fallback) {
	if (value === undefined || value === '') return fallback;
	const parsed = Number(value);
	return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export function loadConfig(env = process.env) {
	const driver = (env.DB_DRIVER || 'mysql').toLowerCase();
	if (!['mysql', 'sqlite', 'auto'].includes(driver)) {
		throw new Error(`Unsupported DB_DRIVER: ${driver}`);
	}

	return {
		nodeEnv: env.NODE_ENV || 'development',
		host: env.HOST || DEFAULT_HOST,
		port: parsePositiveInteger(env.PORT, DEFAULT_PORT),
		version: env.APP_VERSION || 'dev',
		driver,
		mysql: {
			host: env.MYSQL_HOST || '127.0.0.1',
			port: parsePositiveInteger(env.MYSQL_PORT, 3306),
			database: env.MYSQL_DATABASE || 'emaction',
			user: env.MYSQL_USER || 'emaction_app',
			password: env.MYSQL_PASSWORD || '',
			connectionLimit: parsePositiveInteger(env.MYSQL_CONNECTION_LIMIT, 5),
			connectTimeout: parsePositiveInteger(env.MYSQL_CONNECT_TIMEOUT_MS, 5000),
		},
		sqlite: {
			path: env.SQLITE_PATH || './data/emaction.sqlite',
			busyTimeout: parsePositiveInteger(env.SQLITE_BUSY_TIMEOUT_MS, 5000),
		},
	};
}
