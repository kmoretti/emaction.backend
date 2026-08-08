import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const sqliteSchema = fs.readFileSync(new URL('../migrations/001_create_reactions.sqlite.sql', import.meta.url), 'utf8');
let SqliteRepository;
let initializeSqliteDatabase;
let sqliteAvailable = true;
let probePath;
try {
	({ SqliteRepository, initializeSqliteDatabase } = await import('../src/db/sqlite.js'));
	const probe = tempDatabase();
	probePath = probe.directory;
	initializeSqliteDatabase({ sqlite: { path: probe.path, busyTimeout: 1000 } });
	const repository = new SqliteRepository({ sqlite: { path: probe.path, busyTimeout: 1000 } });
	await repository.close();
	fs.rmSync(probe.directory, { recursive: true, force: true });
} catch (error) {
	if (probePath) fs.rmSync(probePath, { recursive: true, force: true });
	if (process.env.REQUIRE_SQLITE_TESTS === '1') throw error;
	sqliteAvailable = false;
}

function tempDatabase() {
	const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'emaction-'));
	return { directory, path: path.join(directory, 'emaction.sqlite') };
}

test('SQLite repository applies concurrent deltas without losing increments', { skip: !sqliteAvailable }, async () => {
	const database = tempDatabase();
	const config = { sqlite: { path: database.path, busyTimeout: 5000 } };
	initializeSqliteDatabase(config, sqliteSchema);
	const repository = await SqliteRepository.create(config);

	await Promise.all(Array.from({ length: 50 }, () => repository.applyDelta('page', 'thumbs-up', 1)));
	const rows = await repository.getReactions('page');
	assert.deepEqual(rows, [{ reaction_name: 'thumbs-up', count: 50 }]);
	await repository.close();
	fs.rmSync(database.directory, { recursive: true, force: true });
});
