import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import worker, { REJECT_REASONS, TRELLO_HOSTS } from '../src/cloudflare-worker-cors-proxy/index.js';

const PROXY = 'https://proxy.example.workers.dev/';
const ATTACHMENT_URL = 'https://trello.com/1/cards/abc/attachments/def/download/song.mp3';
const ENV = { ALLOWED_ORIGIN_DOMAIN: 'player.example.com' };

function proxyRequest({
  url = ATTACHMENT_URL,
  origin = 'https://player.example.com',
  method = 'GET',
  headers = {},
} = {}) {
  const target = url === null ? PROXY : `${PROXY}?url=${encodeURIComponent(url)}`;
  const allHeaders = { ...headers };
  if (origin !== null) {
    allHeaders.Origin = origin;
  }
  return new Request(target, { method, headers: allHeaders });
}

function audioResponse() {
  return new Response('audio-bytes', {
    status: 200,
    headers: { 'Content-Type': 'audio/mpeg' },
  });
}

function redirectTo(location, status = 302) {
  return new Response(null, { status, headers: { Location: location } });
}

// Serves the given responses in order, recording each upstream request.
function upstreamSequence(calls, responses) {
  return async (request) => {
    calls.push(request);
    const next = responses.shift();
    return typeof next === 'function' ? next() : next;
  };
}

const AUTH = 'OAuth oauth_consumer_key="key", oauth_token="token"';

// Every rejection must look exactly like this to the caller.
async function assertForbidden(response, message) {
  assert.equal(response.status, 403, message);
  assert.equal(await response.text(), 'Forbidden', message);
  assert.equal(response.headers.get('Access-Control-Allow-Origin'), null, message);
}

describe('cors proxy', () => {
  let upstreamCalls;
  let originalFetch;
  let originalWarn;
  // Parsed rejection log entries written by the proxy via console.warn.
  let rejections;
  const lastReason = () => rejections.at(-1)?.reason;

  beforeEach(() => {
    upstreamCalls = [];
    rejections = [];
    originalWarn = console.warn;
    console.warn = (line) => rejections.push(JSON.parse(line));
    originalFetch = globalThis.fetch;
    globalThis.fetch = async (request) => {
      upstreamCalls.push(request);
      return audioResponse();
    };
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    console.warn = originalWarn;
  });

  describe('request validation', () => {
    test('rejects requests without a url parameter', async () => {
      const response = await worker.fetch(proxyRequest({ url: null }), ENV);
      assert.equal(response.status, 403);
      assert.equal(upstreamCalls.length, 0);
    });

    test('rejects requests without an Origin header', async () => {
      const response = await worker.fetch(proxyRequest({ origin: null }), ENV);
      assert.equal(response.status, 403);
      assert.equal(upstreamCalls.length, 0);
    });

    test('rejects origins outside the allowed domain', async () => {
      const response = await worker.fetch(proxyRequest({ origin: 'https://evil.example' }), ENV);
      assert.equal(response.status, 403);
      assert.equal(upstreamCalls.length, 0);
    });

    test('rejects look-alike origins that only end with the allowed domain text', async () => {
      const response = await worker.fetch(
        proxyRequest({ origin: 'https://evilplayer.example.com' }),
        ENV,
      );
      assert.equal(response.status, 403);
      assert.equal(upstreamCalls.length, 0);
    });

    test('accepts the exact allowed domain', async () => {
      const response = await worker.fetch(proxyRequest(), ENV);
      assert.equal(response.status, 200);
    });

    test('accepts subdomains of the allowed domain', async () => {
      const response = await worker.fetch(
        proxyRequest({ origin: 'https://preview.player.example.com' }),
        ENV,
      );
      assert.equal(response.status, 200);
    });

    test('accepts any domain from a comma-separated list', async () => {
      const env = { ALLOWED_ORIGIN_DOMAIN: 'other.example, player.example.com' };
      const response = await worker.fetch(proxyRequest(), env);
      assert.equal(response.status, 200);
    });
  });

  describe('CORS preflight', () => {
    test('answers OPTIONS for an allowed origin without calling upstream', async () => {
      const response = await worker.fetch(
        proxyRequest({
          method: 'OPTIONS',
          headers: { 'Access-Control-Request-Headers': 'x-trello-auth' },
        }),
        ENV,
      );
      assert.equal(response.status, 204);
      assert.equal(
        response.headers.get('Access-Control-Allow-Origin'),
        'https://player.example.com',
      );
      assert.equal(response.headers.get('Access-Control-Allow-Headers'), 'x-trello-auth');
      assert.equal(upstreamCalls.length, 0);
    });
  });

  describe('forwarding', () => {
    test('converts x-trello-auth into the upstream Authorization header', async () => {
      await worker.fetch(proxyRequest({ headers: { 'x-trello-auth': AUTH } }), ENV);
      assert.equal(upstreamCalls.length, 1);
      assert.equal(upstreamCalls[0].url, ATTACHMENT_URL);
      assert.equal(upstreamCalls[0].headers.get('Authorization'), AUTH);
    });

    test('does not send an Authorization header when x-trello-auth is absent', async () => {
      await worker.fetch(proxyRequest(), ENV);
      assert.equal(upstreamCalls[0].headers.get('Authorization'), null);
    });

    test('adds CORS and caching headers to the upstream response', async () => {
      const response = await worker.fetch(proxyRequest(), ENV);
      assert.equal(
        response.headers.get('Access-Control-Allow-Origin'),
        'https://player.example.com',
      );
      assert.equal(response.headers.get('Vary'), 'Origin');
      assert.equal(response.headers.get('Cache-Control'), 'private, max-age=86400');
      assert.equal(response.headers.get('Content-Type'), 'audio/mpeg');
      assert.equal(await response.text(), 'audio-bytes');
    });

    test('returns a bare 403 and logs the detail when the upstream fetch throws', async () => {
      globalThis.fetch = async () => {
        throw new Error('secret internal detail');
      };
      const response = await worker.fetch(proxyRequest(), ENV);
      await assertForbidden(response);
      assert.equal(lastReason(), REJECT_REASONS.UPSTREAM_ERROR);
      assert.equal(rejections.at(-1).error, 'secret internal detail');
    });

    test('drops Set-Cookie from upstream responses', async () => {
      globalThis.fetch = async () =>
        new Response('audio-bytes', { status: 200, headers: { 'Set-Cookie': 'session=abc' } });
      const response = await worker.fetch(proxyRequest(), ENV);
      assert.equal(response.headers.get('Set-Cookie'), null);
    });

    test('uses manual redirects so credentials are never auto-forwarded', async () => {
      await worker.fetch(proxyRequest({ headers: { 'x-trello-auth': AUTH } }), ENV);
      assert.equal(upstreamCalls[0].redirect, 'manual');
    });

    test('keeps Authorization on redirects that stay on Trello hosts', async () => {
      globalThis.fetch = upstreamSequence(upstreamCalls, [
        redirectTo('https://api.trello.com/1/files/song.mp3'),
        audioResponse,
      ]);
      const response = await worker.fetch(
        proxyRequest({ headers: { 'x-trello-auth': AUTH } }),
        ENV,
      );
      assert.equal(response.status, 200);
      assert.equal(upstreamCalls.length, 2);
      assert.equal(upstreamCalls[1].headers.get('Authorization'), AUTH);
    });

    test('drops Authorization when a redirect leaves Trello (e.g. signed storage URL)', async () => {
      const signedUrl = 'https://attachments.storage.example/song.mp3?X-Amz-Signature=abc';
      globalThis.fetch = upstreamSequence(upstreamCalls, [redirectTo(signedUrl), audioResponse]);
      const response = await worker.fetch(
        proxyRequest({ headers: { 'x-trello-auth': AUTH } }),
        ENV,
      );
      assert.equal(response.status, 200);
      assert.equal(await response.text(), 'audio-bytes');
      assert.equal(upstreamCalls[0].headers.get('Authorization'), AUTH);
      assert.equal(upstreamCalls[1].url, signedUrl);
      assert.equal(upstreamCalls[1].headers.get('Authorization'), null);
    });

    test('resolves relative redirect locations against the current URL', async () => {
      globalThis.fetch = upstreamSequence(upstreamCalls, [
        redirectTo('/1/other/song.mp3'),
        audioResponse,
      ]);
      await worker.fetch(proxyRequest(), ENV);
      assert.equal(upstreamCalls[1].url, 'https://trello.com/1/other/song.mp3');
    });

    test('refuses redirects to non-https URLs', async () => {
      globalThis.fetch = upstreamSequence(upstreamCalls, [
        redirectTo('http://trello.com/song.mp3'),
      ]);
      const response = await worker.fetch(
        proxyRequest({ headers: { 'x-trello-auth': AUTH } }),
        ENV,
      );
      await assertForbidden(response);
      assert.equal(lastReason(), REJECT_REASONS.BAD_REDIRECT);
      assert.equal(upstreamCalls.length, 1);
    });

    test('refuses redirects with a malformed Location header', async () => {
      globalThis.fetch = upstreamSequence(upstreamCalls, [redirectTo('https://[bad')]);
      const response = await worker.fetch(proxyRequest(), ENV);
      await assertForbidden(response);
      assert.equal(lastReason(), REJECT_REASONS.BAD_REDIRECT);
    });

    test('refuses redirects without a Location header', async () => {
      globalThis.fetch = upstreamSequence(upstreamCalls, [new Response(null, { status: 302 })]);
      const response = await worker.fetch(proxyRequest(), ENV);
      await assertForbidden(response);
      assert.equal(lastReason(), REJECT_REASONS.BAD_REDIRECT);
    });

    test('stops after too many redirects', async () => {
      globalThis.fetch = async (request) => {
        upstreamCalls.push(request);
        return redirectTo('https://trello.com/loop');
      };
      const response = await worker.fetch(proxyRequest(), ENV);
      await assertForbidden(response);
      assert.equal(lastReason(), REJECT_REASONS.TOO_MANY_REDIRECTS);
      assert.equal(upstreamCalls.length, 6);
    });
  });

  describe('security hardening', () => {
    test('rejects target URLs that are not https', async () => {
      const response = await worker.fetch(
        proxyRequest({ url: 'http://trello.com/1/cards/abc/attachments/def/download/song.mp3' }),
        ENV,
      );
      assert.equal(response.status, 403);
      assert.equal(upstreamCalls.length, 0);
    });

    test('rejects target URLs that cannot be parsed', async () => {
      const response = await worker.fetch(proxyRequest({ url: 'not a url' }), ENV);
      assert.equal(response.status, 403);
      assert.equal(upstreamCalls.length, 0);
    });

    test('allows only the Trello hosts', () => {
      assert.deepEqual(TRELLO_HOSTS, ['trello.com', 'api.trello.com']);
    });

    test('rejects target hosts outside the Trello allowlist', async () => {
      for (const url of [
        'https://evil.example/song.mp3',
        'https://trello.com.evil.example/song.mp3',
        'https://eviltrello.com/song.mp3',
        'https://169.254.169.254/latest/meta-data/',
        'https://user@evil.example/trello.com/song.mp3',
      ]) {
        const response = await worker.fetch(proxyRequest({ url }), ENV);
        assert.equal(response.status, 403, url);
      }
      assert.equal(upstreamCalls.length, 0);
    });

    test('never forwards Authorization to non-Trello hosts', async () => {
      const response = await worker.fetch(
        proxyRequest({ url: 'https://evil.example/song.mp3', headers: { 'x-trello-auth': AUTH } }),
        ENV,
      );
      assert.equal(response.status, 403);
      assert.equal(upstreamCalls.length, 0);
    });

    test('rejects methods other than GET, HEAD and OPTIONS', async () => {
      for (const method of ['POST', 'PUT', 'DELETE', 'PATCH']) {
        const response = await worker.fetch(proxyRequest({ method }), ENV);
        await assertForbidden(response, method);
        assert.equal(lastReason(), REJECT_REASONS.METHOD_NOT_ALLOWED);
      }
      assert.equal(upstreamCalls.length, 0);
    });

    test('forwards HEAD requests', async () => {
      const response = await worker.fetch(proxyRequest({ method: 'HEAD' }), ENV);
      assert.equal(response.status, 200);
      assert.equal(upstreamCalls[0].method, 'HEAD');
    });

    test('advertises only GET, HEAD and OPTIONS in preflight responses', async () => {
      const response = await worker.fetch(proxyRequest({ method: 'OPTIONS' }), ENV);
      assert.equal(response.headers.get('Access-Control-Allow-Methods'), 'GET,HEAD,OPTIONS');
    });

    test('refuses all requests when ALLOWED_ORIGIN_DOMAIN is not configured', async () => {
      for (const env of [
        undefined,
        {},
        { ALLOWED_ORIGIN_DOMAIN: '' },
        { ALLOWED_ORIGIN_DOMAIN: ' , ' },
      ]) {
        const response = await worker.fetch(proxyRequest(), env);
        await assertForbidden(response, JSON.stringify(env));
        assert.equal(lastReason(), REJECT_REASONS.NOT_CONFIGURED);
      }
      assert.equal(upstreamCalls.length, 0);
    });

    test('rejects origins that are not valid URLs', async () => {
      for (const origin of ['null', 'player.example.com', 'evil-player.example.com']) {
        const response = await worker.fetch(proxyRequest({ origin }), ENV);
        assert.equal(response.status, 403, origin);
      }
      assert.equal(upstreamCalls.length, 0);
    });
  });

  describe('uniform rejections', () => {
    // One request per rejection reason. Callers must not be able to tell them apart.
    const cases = {
      [REJECT_REASONS.NOT_CONFIGURED]: () => worker.fetch(proxyRequest(), {}),
      [REJECT_REASONS.INVALID_TARGET]: () =>
        worker.fetch(proxyRequest({ url: 'http://trello.com/song.mp3' }), ENV),
      [REJECT_REASONS.TARGET_NOT_ALLOWED]: () =>
        worker.fetch(proxyRequest({ url: 'https://evil.example/song.mp3' }), ENV),
      [REJECT_REASONS.ORIGIN_NOT_ALLOWED]: () =>
        worker.fetch(proxyRequest({ origin: 'https://evil.example' }), ENV),
      [REJECT_REASONS.METHOD_NOT_ALLOWED]: () =>
        worker.fetch(proxyRequest({ method: 'POST' }), ENV),
      [REJECT_REASONS.BAD_REDIRECT]: () => {
        globalThis.fetch = async () => redirectTo('http://insecure.example/');
        return worker.fetch(proxyRequest(), ENV);
      },
      [REJECT_REASONS.TOO_MANY_REDIRECTS]: () => {
        globalThis.fetch = async () => redirectTo('https://trello.com/loop');
        return worker.fetch(proxyRequest(), ENV);
      },
      [REJECT_REASONS.UPSTREAM_ERROR]: () => {
        globalThis.fetch = async () => {
          throw new Error('boom');
        };
        return worker.fetch(proxyRequest(), ENV);
      },
    };

    test('covers every rejection reason', () => {
      assert.deepEqual(Object.keys(cases).sort(), Object.values(REJECT_REASONS).sort());
    });

    test('every rejection returns an identical response and logs its reason', async () => {
      let reference;
      for (const [reason, run] of Object.entries(cases)) {
        const response = await run();
        const snapshot = {
          status: response.status,
          body: await response.text(),
          headers: [...response.headers.entries()],
        };
        reference ??= snapshot;
        assert.deepEqual(snapshot, reference, reason);
        assert.equal(lastReason(), reason);
      }
      assert.equal(reference.status, 403);
      assert.equal(reference.body, 'Forbidden');
    });

    test('rejection logs never contain credentials, paths or query strings', async () => {
      await worker.fetch(
        proxyRequest({
          url: 'https://evil.example/secret/path.mp3?token=abc',
          headers: { 'x-trello-auth': AUTH },
        }),
        ENV,
      );
      const logged = JSON.stringify(rejections);
      assert.equal(lastReason(), REJECT_REASONS.TARGET_NOT_ALLOWED);
      assert.equal(rejections.at(-1).host, 'evil.example');
      for (const secret of ['oauth_token', 'token=abc', '/secret/path.mp3']) {
        assert.ok(!logged.includes(secret), secret);
      }
    });
  });
});
