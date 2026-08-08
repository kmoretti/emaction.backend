import { loadConfig } from '../src/config.js';

const config = loadConfig(process.env);
console.log(JSON.stringify({
	nodeEnv: config.nodeEnv,
	host: config.host,
	port: config.port,
	driver: config.driver,
	mysqlHost: config.mysql.host,
	mysqlDatabase: config.mysql.database,
	sqlitePath: config.sqlite.path,
}, null, 2));
