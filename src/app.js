const corsHeaders = {
	'Access-Control-Allow-Origin': '*',
	'Access-Control-Allow-Methods': 'GET, PATCH, OPTIONS',
	'Access-Control-Allow-Headers': 'Content-Type',
};

function withCors(headers = {}) {
	return { ...headers, ...corsHeaders };
}

function textResponse(body, status = 200, headers = {}) {
	return new Response(body, { status, headers: withCors(headers) });
}

function jsonResponse(code, msg, data, status = 200) {
	const body = { code, msg };
	if (data !== undefined) body.data = data;
	return new Response(JSON.stringify(body), {
		status,
		headers: withCors({ 'content-type': 'application/json;charset=UTF-8' }),
	});
}

function parseDiff(raw) {
	const value = Number.parseInt(raw, 10);
	if (!Number.isFinite(value) || value === 0) return null;
	return value > 0 ? 1 : -1;
}

function healthResponse(state, healthy) {
	const body = healthy
		? {
				status: 'ok',
				database: state.database,
				mode: state.mode,
				degraded: state.degraded,
				version: state.version,
			}
		: {
				status: 'error',
				database: state.database,
				mode: state.mode,
				degraded: state.degraded,
			};
	return new Response(JSON.stringify(body), {
		status: healthy ? 200 : 503,
		headers: withCors({ 'content-type': 'application/json;charset=UTF-8' }),
	});
}

export function createApp({ repositoryState, version = 'dev', logger = console }) {
	const state = { ...repositoryState, version };

	return async function handle(request) {
		const url = new URL(request.url);
		const method = request.method.toLowerCase();

		if (method === 'options') {
			return textResponse(`<img src="https://http.cat/200" alt="That's Ok.">`, 200, {
				'Content-Type': 'text/html',
			});
		}

		if (method === 'get' && url.pathname === '/health') {
			try {
				await state.repository.healthCheck();
				return healthResponse(state, true);
			} catch (error) {
				logger.error(`Health check failed: ${error.message}`);
				return healthResponse(state, false);
			}
		}

		if (method === 'get' && url.pathname === '/reactions') {
			const targetId = url.searchParams.get('targetId');
			if (!targetId) return textResponse('Empty targetId', 400);

			try {
				const reactions = await state.repository.getReactions(targetId);
				return jsonResponse(0, 'success', { reactionsGot: reactions });
			} catch (error) {
				logger.error(`GET /reactions failed: ${error.message}`);
				return jsonResponse(1, 'fail');
			}
		}

		if (method === 'patch' && url.pathname === '/reaction') {
			const targetId = url.searchParams.get('targetId');
			const reactionName = url.searchParams.get('reaction_name');
			const diff = parseDiff(url.searchParams.get('diff'));
			if (!targetId || !reactionName || diff === null) {
				return textResponse('Invalid Response.', 400);
			}
			try {
				await state.repository.applyDelta(targetId, reactionName, diff);
				return jsonResponse(0, 'success');
			} catch (error) {
				logger.error(`PATCH /reaction failed: ${error.message}`);
				return jsonResponse(1, 'fail');
			}
		}

		return textResponse(`<img src="https://http.cat/404" alt="404 Not Found">`, 404, {
			'Content-Type': 'text/html',
		});
	};
}

export { corsHeaders, parseDiff };
