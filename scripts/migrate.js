import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadConfig } from '../src/config.js';
import { initializeMysqlDatabase } from '../src/db/mysql.js';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const driver = process.argv[2];
if (!['mysql', 'sqlite'].includes(driver)) {
	console.error('Usage: node scripts/migrate.js <mysql|sqlite>');
	process.exit(1);
}

const migrationEnv = { ...process.env, DB_DRIVER: driver };
if (driver === 'mysql') {
	for (const field of ['HOST', 'PORT', 'DATABASE', 'USER', 'PASSWORD']) {
		const migrationValue = process.env[`MIGRATION_MYSQL_${field}`];
		if (migrationValue !== undefined) migrationEnv[`MYSQL_${field}`] = migrationValue;
	}
}
const config = loadConfig(migrationEnv);
const migrationFile = path.join(projectRoot, 'migrations', `001_create_reactions.${driver}.sql`);
if (!fs.existsSync(migrationFile)) throw new Error(`Missing migration: ${migrationFile}`);
const schema = fs.readFileSync(migrationFile, 'utf8');
if (driver === 'mysql') {
	await initializeMysqlDatabase(config, schema);
} else {
	const { initializeSqliteDatabase } = await import('../src/db/sqlite.js');
	initializeSqliteDatabase(config, schema);
}
console.log(`${driver} database initialized from ${migrationFile}`);
