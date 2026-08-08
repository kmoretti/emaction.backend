import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';

function createRepository() {
	const rows = new Map();
	return {
		rows,
		driver: 'sqlite',
		async getReactions(targetId) {
			return [...rows.entries()]
				.filter(([key]) => key.startsWith(`${targetId}\u0000`))
				.map(([key, count]) => ({ reaction_name: key.split('\u0000')[1], count }))
				.sort((a, b) => a.reaction_name.localeCompare(b.reaction_name));
		},
		async applyDelta(targetId, reactionName, diff) {
			const key = `${targetId}\u0000${reactionName}`;
			rows.set(key, Math.max(0, (rows.get(key) || 0) + diff));
		},
		async healthCheck() { return true; },
	};
}

async function request(app, path, init = {}) {
	return app(new Request(`http://localhost${path}`, init));
}

test('GET /reactions returns frontend-compatible empty data', async () => {
	const app = createApp({ repositoryState: { repository: createRepository(), database: 'sqlite', mode: 'primary', degraded: false } });
	const response = await request(app, '/reactions?targetId=page-1');
	assert.equal(response.status, 200);
	assert.deepEqual(await response.json(), { code: 0, msg: 'success', data: { reactionsGot: [] } });
});

test('PATCH increments and decrements atomically through the repository contract', async () => {
	const repository = createRepository();
	const app = createApp({ repositoryState: { repository, database: 'sqlite', mode: 'primary', degraded: false } });
	assert.equal((await request(app, '/reaction?targetId=p&reaction_name=thumbs-up&diff=1', { method: 'PATCH' })).status, 200);
	assert.equal((await request(app, '/reaction?targetId=p&reaction_name=thumbs-up&diff=-1', { method: 'PATCH' })).status, 200);
	const result = await (await request(app, '/reactions?targetId=p')).json();
	assert.deepEqual(result.data.reactionsGot, [{ reaction_name: 'thumbs-up', count: 0 }]);
});

test('invalid zero diff does not mutate the counter', async () => {
	const repository = createRepository();
	const app = createApp({ repositoryState: { repository, database: 'sqlite', mode: 'primary', degraded: false } });
	const response = await request(app, '/reaction?targetId=p&reaction_name=thumbs-up&diff=0', { method: 'PATCH' });
	assert.equal(response.status, 400);
	assert.equal(repository.rows.size, 0);
});

test('OPTIONS, CORS and health remain available', async () => {
	const app = createApp({ version: 'test', repositoryState: { repository: createRepository(), database: 'sqlite', mode: 'fallback', degraded: true } });
	const options = await request(app, '/reaction', { method: 'OPTIONS' });
	assert.equal(options.status, 200);
	assert.equal(options.headers.get('access-control-allow-origin'), '*');
	const health = await request(app, '/health');
	assert.equal(health.status, 200);
	assert.deepEqual(await health.json(), { status: 'ok', database: 'sqlite', mode: 'fallback', degraded: true, version: 'test' });
});
