import test from 'node:test';
import assert from 'node:assert/strict';
import { MysqlRepository } from '../src/db/mysql.js';

const hasMysqlConfig = process.env.MYSQL_TEST_HOST && process.env.MYSQL_TEST_PASSWORD;

test('MySQL repository applies concurrent deltas without losing increments', { skip: !hasMysqlConfig }, async () => {
	const config = {
		mysql: {
			host: process.env.MYSQL_TEST_HOST,
			port: Number(process.env.MYSQL_TEST_PORT || 3306),
			database: process.env.MYSQL_TEST_DATABASE || 'emaction_test',
			user: process.env.MYSQL_TEST_USER || 'root',
			password: process.env.MYSQL_TEST_PASSWORD,
			connectionLimit: 5,
			connectTimeout: 5000,
		},
	};
	const repository = await MysqlRepository.create(config);
	try {
		await repository.pool.query(`
			create table if not exists reactions (
				target_id varchar(255) not null,
				reaction_name varchar(100) not null,
				count int unsigned not null default 0,
				created_at bigint not null,
				updated_at bigint not null,
				unique key uq_test_reactions (target_id, reaction_name)
			) engine=InnoDB
		`);
		await repository.pool.query('delete from reactions where target_id = ?', ['ci-concurrency']);
		await Promise.all(Array.from({ length: 50 }, () => repository.applyDelta('ci-concurrency', 'thumbs-up', 1)));
		const rows = await repository.getReactions('ci-concurrency');
		assert.deepEqual(rows, [{ reaction_name: 'thumbs-up', count: 50 }]);
	} finally {
		await repository.pool.query('drop table if exists reactions');
		await repository.close();
	}
});
