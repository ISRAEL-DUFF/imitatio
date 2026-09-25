import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { describeLlmError, LlmError } from '../src/lib/llm/errors.ts';
import { complete, type ClientDeps, type CompletionRequest } from '../src/lib/llm/openrouter.ts';

const REQ: CompletionRequest = { model: 'google/gemini-3.7-flash', system: 'sys', user: 'hello' };

function ok(content: unknown, extra: Record<string, unknown> = {}) {
  return Response.json({
    model: 'google/gemini-3.7-flash',
    choices: [{ finish_reason: 'stop', message: { content } }],
    usage: { prompt_tokens: 10, completion_tokens: 3 },
    ...extra,
  });
}

function err(status: number, message = 'nope', headers: Record<string, string> = {}) {
  return Response.json({ error: { code: status, message } }, { status, headers });
}

/** A fetch that replays responses in order and records what it was sent. */
function scripted(...responses: (Response | Error)[]) {
  const calls: { url: string; init: RequestInit }[] = [];
  const sleeps: number[] = [];
  const fetch = (async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    const next = responses.shift();
    if (!next) throw new Error('no more scripted responses');
    if (next instanceof Error) throw next;
    return next;
  }) as unknown as typeof globalThis.fetch;
  const deps: ClientDeps = { apiKey: 'sk-or-test', fetch, sleep: async (ms) => void sleeps.push(ms) };
  return { deps, calls, sleeps };
}

async function kindOf(p: Promise<unknown>) {
  try {
    await p;
  } catch (e) {
    assert.ok(e instanceof LlmError, `expected LlmError, got ${e}`);
    return e.kind;
  }
  assert.fail('expected a rejection');
}

describe('complete', () => {
  test('sends an OpenAI-style request with a Bearer key', async () => {
    const { deps, calls } = scripted(ok('χαῖρε'));
    const res = await complete({ ...REQ, maxTokens: 50 }, deps);

    assert.equal(res.text, 'χαῖρε');
    assert.equal(res.model, 'google/gemini-3.7-flash');
    assert.deepEqual(res.usage, { promptTokens: 10, completionTokens: 3 });

    assert.equal(calls[0].url, 'https://openrouter.ai/api/v1/chat/completions');
    const headers = calls[0].init.headers as Record<string, string>;
    assert.equal(headers.authorization, 'Bearer sk-or-test');
    assert.equal(headers['X-Title'], 'Imitatio');
    const body = JSON.parse(calls[0].init.body as string);
    assert.deepEqual(body.messages, [
      { role: 'system', content: 'sys' },
      { role: 'user', content: 'hello' },
    ]);
    assert.equal(body.max_tokens, 50);
    assert.equal(body.response_format, undefined);
  });

  test('asks for JSON mode only when requested', async () => {
    const { deps, calls } = scripted(ok('{}'));
    await complete({ ...REQ, json: true }, deps);
    assert.deepEqual(JSON.parse(calls[0].init.body as string).response_format, { type: 'json_object' });
  });

  test('joins content returned as an array of parts', async () => {
    const { deps } = scripted(ok([{ type: 'text', text: 'ab' }, { type: 'text', text: 'c' }]));
    assert.equal((await complete(REQ, deps)).text, 'abc');
  });

  test('no key fails before any request', async () => {
    const { deps, calls } = scripted();
    assert.equal(await kindOf(complete(REQ, { ...deps, apiKey: '  ' })), 'no_key');
    assert.equal(calls.length, 0);
  });

  for (const [status, kind] of [
    [401, 'unauthorized'],
    [403, 'unauthorized'],
    [402, 'no_credits'],
    [400, 'bad_request'],
    [404, 'bad_request'],
    [500, 'server'],
  ] as const) {
    test(`${status} → ${kind}, without retrying`, async () => {
      const { deps, calls } = scripted(err(status));
      assert.equal(await kindOf(complete(REQ, deps)), kind);
      assert.equal(calls.length, 1);
    });
  }

  test('retries 429 with backoff, then succeeds', async () => {
    const { deps, calls, sleeps } = scripted(err(429), err(503), ok('done'));
    assert.equal((await complete(REQ, deps)).text, 'done');
    assert.equal(calls.length, 3);
    assert.deepEqual(sleeps, [1000, 2000]);
  });

  test('honours Retry-After', async () => {
    const { deps, sleeps } = scripted(err(429, 'slow down', { 'retry-after': '5' }), ok('done'));
    await complete(REQ, deps);
    assert.deepEqual(sleeps, [5000]);
  });

  test('gives up after three attempts', async () => {
    const { deps, calls } = scripted(err(429), err(502), err(503));
    const e = await complete(REQ, deps).catch((x) => x);
    assert.equal(e.kind, 'rate_limited');
    assert.equal(e.status, 503);
    assert.equal(calls.length, 3);
  });

  test('an error inside a 200 response is still an error', async () => {
    const { deps, calls } = scripted(
      Response.json({ error: { code: 502, message: 'upstream' } }),
      Response.json({ error: { code: 402, message: 'credits' } }),
    );
    assert.equal(await kindOf(complete(REQ, deps)), 'no_credits');
    assert.equal(calls.length, 2);
  });

  test('network failure', async () => {
    const { deps } = scripted(new TypeError('Failed to fetch'));
    assert.equal(await kindOf(complete(REQ, deps)), 'network');
  });

  test('user abort', async () => {
    const ctrl = new AbortController();
    ctrl.abort();
    const { deps } = scripted(new DOMException('aborted', 'AbortError'));
    assert.equal(await kindOf(complete({ ...REQ, signal: ctrl.signal }, deps)), 'aborted');
  });

  test('timeout', async () => {
    const fetch = ((_url: string, init: RequestInit) =>
      new Promise((_, reject) =>
        init.signal!.addEventListener('abort', () => reject(new DOMException('timed out', 'TimeoutError'))),
      )) as unknown as typeof globalThis.fetch;
    // AbortSignal.timeout's timer does not keep Node's event loop alive; hold it open.
    const keepAlive = setTimeout(() => {}, 5000);
    try {
      assert.equal(await kindOf(complete(REQ, { apiKey: 'k', fetch, timeoutMs: 20 })), 'timeout');
    } finally {
      clearTimeout(keepAlive);
    }
  });

  test('empty content', async () => {
    const { deps } = scripted(ok(null, {}), ok('   '));
    assert.equal(await kindOf(complete(REQ, deps)), 'empty');
    assert.equal(await kindOf(complete(REQ, deps)), 'empty');
  });

  test('malformed body', async () => {
    const { deps } = scripted(Response.json({ choices: [] }));
    assert.equal(await kindOf(complete(REQ, deps)), 'empty');
  });
});

describe('describeLlmError', () => {
  test('each case points at the right remedy', () => {
    assert.equal(describeLlmError(new LlmError('no_key')).action, 'settings');
    assert.equal(describeLlmError(new LlmError('unauthorized')).title, 'Your API key was rejected');
    assert.equal(describeLlmError(new LlmError('no_credits')).action, 'credits');
    assert.equal(describeLlmError(new LlmError('rate_limited')).action, 'retry');
    assert.equal(describeLlmError(new LlmError('network')).action, 'retry');
    assert.equal(describeLlmError(new Error('boom')).message, 'boom');
  });
});
