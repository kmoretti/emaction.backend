import http from 'node:http';
import { pathToFileURL } from 'node:url';
import { createApp } from './app.js';
import { loadConfig } from './config.js';
import { createRepository } from './db/index.js';

function toRequest(req) {
	const headers = new Headers();
	for (const [name, value] of Object.entries(req.headers)) {
		if (Array.isArray(value)) headers.set(name, value.join(', '));
		else if (value !== undefined) headers.set(name, value);
	}
	return new Request(`http://${req.headers.host || 'localhost'}${req.url}`, {
		method: req.method,
		headers,
	});
}

async function writeResponse(res, response) {
	res.statusCode = response.status;
	for (const [name, value] of response.headers) res.setHeader(name, value);
	res.end(Buffer.from(await response.arrayBuffer()));
}

export async function startServer({ env = process.env, logger = console } = {}) {
	const config = loadConfig(env);
	const repositoryState = await createRepository(config, logger);
	const app = createApp({ repositoryState, version: config.version, logger });
	const server = http.createServer(async (req, res) => {
		try {
			await writeResponse(res, await app(toRequest(req)));
		} catch (error) {
			logger.error(`Unhandled request error: ${error.message}`);
			res.statusCode = 500;
			res.end('Internal Server Error');
		}
	});

	await new Promise((resolve, reject) => {
		server.once('error', reject);
		server.listen(config.port, config.host, resolve);
	});

	logger.log(`emaction backend listening on ${config.host}:${config.port} (${repositoryState.database}/${repositoryState.mode})`);

	const close = async () => {
		await repositoryState.repository.close();
		await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
	};
	const shutdown = signal => {
		logger.log(`Received ${signal}; shutting down`);
		close().then(() => process.exit(0)).catch(error => {
			logger.error(`Shutdown failed: ${error.message}`);
			process.exit(1);
		});
	};
	process.once('SIGTERM', () => shutdown('SIGTERM'));
	process.once('SIGINT', () => shutdown('SIGINT'));
	return { server, repositoryState, close };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	startServer().catch(error => {
		console.error(error.stack || error.message);
		process.exitCode = 1;
	});
}
